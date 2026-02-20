"""Supabase queue + log + settings helpers (server-side only)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from supabase import create_client, Client

_client: Client | None = None


def _sb() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


# ── Types ──────────────────────────────────────────────────────────────────────

@dataclass
class QueueItem:
    id: str
    topic: str
    focus_keyphrase: str | None
    keywords: list[str] | None
    status: str
    created_at: str
    processed_at: str | None


@dataclass
class ScheduleSettings:
    active: bool
    run_times: list[str]
    timezone: str


# ── Queue helpers ──────────────────────────────────────────────────────────────

def dequeue_next_topic() -> QueueItem | None:
    res = (
        _sb()
        .from_("automation_queue")
        .select("*")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None

    row = res.data[0]
    # Mark as in_progress
    _sb().from_("automation_queue").update({"status": "in_progress"}).eq("id", row["id"]).execute()
    return _row_to_queue_item(row)


def update_queue_status(item_id: str, status: str, set_processed_at: bool = False) -> None:
    payload: dict[str, Any] = {"status": status}
    if set_processed_at:
        from datetime import datetime, timezone
        payload["processed_at"] = datetime.now(timezone.utc).isoformat()
    _sb().from_("automation_queue").update(payload).eq("id", item_id).execute()


def get_all_queue_items() -> list[QueueItem]:
    res = _sb().from_("automation_queue").select("*").order("created_at", desc=True).execute()
    return [_row_to_queue_item(r) for r in (res.data or [])]


def count_pending_queue_items() -> int:
    res = (
        _sb()
        .from_("automation_queue")
        .select("*", count="exact", head=True)
        .eq("status", "pending")
        .execute()
    )
    return res.count or 0


def add_queue_item(
    topic: str,
    focus_keyphrase: str | None = None,
    keywords: list[str] | None = None,
) -> QueueItem:
    res = (
        _sb()
        .from_("automation_queue")
        .insert({
            "topic": topic,
            "focus_keyphrase": focus_keyphrase,
            "keywords": keywords,
        })
        .execute()
    )
    if not res.data:
        raise RuntimeError("Failed to add queue item")
    return _row_to_queue_item(res.data[0])


def reset_in_progress_items() -> None:
    """Reset items stuck as in_progress from a crashed run."""
    _sb().from_("automation_queue").update({"status": "pending"}).eq("status", "in_progress").execute()


# ── Log helpers ────────────────────────────────────────────────────────────────

def insert_log(
    queue_id: str | None,
    post_id: str | None,
    status: str,
    confidence_score: int | None,
    seo_checks_passed: int | None,
    revision_notes: str | None,
    error_message: str | None,
) -> None:
    _sb().from_("automation_logs").insert({
        "queue_id": queue_id,
        "post_id": post_id,
        "status": status,
        "confidence_score": confidence_score,
        "seo_checks_passed": seo_checks_passed,
        "revision_notes": revision_notes,
        "error_message": error_message,
    }).execute()


# ── Schedule settings ──────────────────────────────────────────────────────────

def get_schedule_settings() -> ScheduleSettings:
    try:
        res = (
            _sb()
            .from_("app_settings")
            .select("key, value")
            .in_("key", ["scheduler_active", "scheduler_run_times", "scheduler_timezone"])
            .execute()
        )
        m: dict[str, Any] = {r["key"]: r["value"] for r in (res.data or [])}

        raw_active = m.get("scheduler_active")
        active = raw_active is True or raw_active == "true" if raw_active is not None else True

        raw_times = m.get("scheduler_run_times")
        run_times = raw_times if isinstance(raw_times, list) else ["06:00", "12:00", "18:00"]

        raw_tz = m.get("scheduler_timezone")
        timezone = raw_tz if isinstance(raw_tz, str) else "UTC"

        return ScheduleSettings(active=active, run_times=run_times, timezone=timezone)
    except Exception:
        return ScheduleSettings(active=True, run_times=["06:00", "12:00", "18:00"], timezone="UTC")


def get_scheduler_active() -> bool:
    return get_schedule_settings().active


# ── Internal helpers ───────────────────────────────────────────────────────────

def _row_to_queue_item(r: dict[str, Any]) -> QueueItem:
    return QueueItem(
        id=r["id"],
        topic=r["topic"],
        focus_keyphrase=r.get("focus_keyphrase"),
        keywords=r.get("keywords"),
        status=r["status"],
        created_at=r["created_at"],
        processed_at=r.get("processed_at"),
    )


