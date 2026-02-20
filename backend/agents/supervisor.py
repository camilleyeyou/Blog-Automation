"""Supervisor agent — orchestrates the full pipeline for one queue item."""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Callable, TypeVar

from agents.content import run_content_agent, ContentDraft
from agents.revision import run_revision_agent
from agents.image import run_image_agent
from agents.topic import run_topic_agent
from services import supabase_client as db
from services.blog_api import create_post

T = TypeVar("T")

_AUTO_PUBLISH_THRESHOLD = 85
_DRAFT_THRESHOLD = 70
_MAX_RETRIES = 2
_QUEUE_REPLENISH_THRESHOLD = 6
_QUEUE_REPLENISH_COUNT = 15


@dataclass
class PipelineResult:
    status: str          # "success" | "draft" | "held" | "error"
    topic: str | None
    post_id: str | None = None
    slug: str | None = None
    confidence_score: int | None = None
    seo_checks_passed: int | None = None
    revision_notes: str | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v is not None}


def run_pipeline() -> PipelineResult:
    """Run one full pipeline iteration synchronously."""
    # 1. Auto-replenish queue if running low (fire-and-forget in thread)
    pending = db.count_pending_queue_items()
    if pending < _QUEUE_REPLENISH_THRESHOLD:
        import threading
        t = threading.Thread(target=_replenish_queue, daemon=True)
        t.start()

    # 2. Dequeue next topic
    db.reset_in_progress_items()
    item = db.dequeue_next_topic()
    if item is None:
        return PipelineResult(status="error", topic=None, error="No pending topics in queue")

    topic = item.topic
    focus_keyphrase = item.focus_keyphrase or topic

    try:
        # 3. Generate content draft
        draft: ContentDraft = _with_retry(
            lambda: run_content_agent(topic, focus_keyphrase)
        )

        # 4. Revise + SEO audit
        revision = _with_retry(lambda: run_revision_agent(draft))

        # 5. Hold if below threshold
        if revision.confidence_score < _DRAFT_THRESHOLD:
            db.update_queue_status(item.id, "held", set_processed_at=True)
            db.insert_log(
                queue_id=item.id,
                post_id=None,
                status="held",
                confidence_score=revision.confidence_score,
                seo_checks_passed=revision.seo_checks_passed,
                revision_notes=revision.revision_notes,
                error_message=None,
            )
            return PipelineResult(
                status="held",
                topic=topic,
                confidence_score=revision.confidence_score,
                seo_checks_passed=revision.seo_checks_passed,
                revision_notes=revision.revision_notes,
            )

        # 6. Generate + upload cover image
        cover_image_url: str = _with_retry(
            lambda: run_image_agent(revision.title, revision.excerpt)
        )

        # 7. Validate payload
        _validate_payload(revision, cover_image_url)

        # 8. Determine publish mode
        published = revision.confidence_score >= _AUTO_PUBLISH_THRESHOLD

        # 9. POST to blog API
        post = _with_retry(lambda: create_post(
            title=revision.title,
            excerpt=revision.excerpt,
            content=revision.content,
            author="Jesse A. Eisenbalm",
            cover_image=cover_image_url,
            tags=revision.tags,
            published=published,
        ))

        # 10. Update queue + log
        db.update_queue_status(item.id, "published", set_processed_at=True)
        log_status = "success" if published else "draft"
        db.insert_log(
            queue_id=item.id,
            post_id=post.id,
            status=log_status,
            confidence_score=revision.confidence_score,
            seo_checks_passed=revision.seo_checks_passed,
            revision_notes=revision.revision_notes,
            error_message=None,
        )

        return PipelineResult(
            status=log_status,
            topic=topic,
            post_id=post.id,
            slug=post.slug,
            confidence_score=revision.confidence_score,
            seo_checks_passed=revision.seo_checks_passed,
            revision_notes=revision.revision_notes,
        )

    except Exception as exc:
        error_message = str(exc)
        db.update_queue_status(item.id, "pending")  # return to queue
        try:
            db.insert_log(
                queue_id=item.id,
                post_id=None,
                status="error",
                confidence_score=None,
                seo_checks_passed=None,
                revision_notes=None,
                error_message=error_message,
            )
        except Exception:
            pass
        return PipelineResult(status="error", topic=topic, error=error_message)


def run_replenish() -> dict:
    """Generate new topics and insert them into the queue."""
    all_items = db.get_all_queue_items()
    existing = [i.topic for i in all_items]
    suggestions = run_topic_agent(_QUEUE_REPLENISH_COUNT, existing)
    for s in suggestions:
        db.add_queue_item(s.topic, s.focus_keyphrase, s.keywords)
    return {"added": len(suggestions), "message": f"Added {len(suggestions)} topics to the queue"}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _with_retry(fn: Callable[[], T]) -> T:
    last_exc: Exception | None = None
    for attempt in range(1, _MAX_RETRIES + 2):
        try:
            return fn()
        except Exception as exc:
            last_exc = exc
            if attempt <= _MAX_RETRIES:
                delay = _parse_retry_delay(exc) or (1.0 * attempt)
                time.sleep(delay)
    raise last_exc  # type: ignore[misc]


def _parse_retry_delay(exc: Exception) -> float | None:
    import re
    m = re.search(r'"retryDelay"\s*:\s*"(\d+)s"', str(exc))
    return float(m.group(1)) if m else None


def _validate_payload(revision: object, cover_image_url: str) -> None:
    from agents.revision import RevisionResult
    assert isinstance(revision, RevisionResult)
    if not revision.title.strip():
        raise RuntimeError("Supervisor: revised title is empty")
    if not revision.excerpt.strip():
        raise RuntimeError("Supervisor: revised excerpt is empty")
    if not revision.content.strip():
        raise RuntimeError("Supervisor: revised content is empty")
    if not cover_image_url.startswith("http"):
        raise RuntimeError("Supervisor: invalid cover image URL")


def _replenish_queue() -> None:
    try:
        run_replenish()
    except Exception as exc:
        print(f"[replenish] non-fatal error: {exc}")
