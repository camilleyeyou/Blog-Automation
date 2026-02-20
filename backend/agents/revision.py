"""Revision agent — audits 15 Yoast SEO checks and returns an improved draft."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass

from openai import OpenAI

from agents.content import ContentDraft
from prompts.revision_prompt import build_revision_system_prompt, build_revision_user_prompt

_client: OpenAI | None = None


def _openai() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


@dataclass
class RevisionResult:
    title: str
    excerpt: str
    content: str
    tags: list[str]
    confidence_score: int
    seo_checks_passed: int
    revision_notes: str


def run_revision_agent(draft: ContentDraft) -> RevisionResult:
    response = _openai().chat.completions.create(
        model="gpt-4o",
        temperature=0.3,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": build_revision_system_prompt()},
            {
                "role": "user",
                "content": build_revision_user_prompt(
                    draft.title,
                    draft.excerpt,
                    draft.content,
                    draft.tags,
                    draft.focus_keyphrase,
                ),
            },
        ],
    )

    raw = response.choices[0].message.content
    if not raw:
        raise RuntimeError("Revision agent returned empty response")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError(f"Revision agent returned invalid JSON: {raw[:200]}")

    return _validate(parsed)


def _validate(data: object) -> RevisionResult:
    if not isinstance(data, dict):
        raise RuntimeError("Revision agent: response is not an object")

    title = data.get("title", "")
    if not isinstance(title, str) or not title.strip():
        raise RuntimeError("Revision agent: missing title")

    excerpt = data.get("excerpt", "")
    if not isinstance(excerpt, str) or not excerpt.strip():
        raise RuntimeError("Revision agent: missing excerpt")

    content = data.get("content", "")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Revision agent: missing content")

    tags = data.get("tags", [])
    if not isinstance(tags, list):
        raise RuntimeError("Revision agent: missing tags")

    confidence_score = data.get("confidence_score")
    if not isinstance(confidence_score, (int, float)):
        raise RuntimeError("Revision agent: missing confidence_score")

    seo_checks_passed = data.get("seo_checks_passed")
    if not isinstance(seo_checks_passed, (int, float)):
        raise RuntimeError("Revision agent: missing seo_checks_passed")

    revision_notes = data.get("revision_notes", "")
    if not isinstance(revision_notes, str):
        raise RuntimeError("Revision agent: missing revision_notes")

    return RevisionResult(
        title=title.strip(),
        excerpt=excerpt.strip(),
        content=content.strip(),
        tags=[str(t) for t in tags],
        confidence_score=min(100, max(0, round(float(confidence_score)))),
        seo_checks_passed=min(15, max(0, round(float(seo_checks_passed)))),
        revision_notes=revision_notes.strip(),
    )
