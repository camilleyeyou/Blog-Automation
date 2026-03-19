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
    word_count: int
    flagged_issues: list[str]
    revision_notes: str


def run_revision_agent(draft: ContentDraft) -> RevisionResult:
    response = _openai().chat.completions.create(
        model="gpt-4o",
        temperature=0.3,
        max_tokens=16384,
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


def expand_content(
    content: str,
    title: str,
    focus_keyphrase: str,
    current_word_count: int,
    target_word_count: int = 1500,
) -> str:
    """Add new sections to existing content to reach the target word count.

    Returns the full HTML body with new sections inserted before the closing.
    Does NOT rewrite existing content — only appends new material.
    """
    words_needed = target_word_count - current_word_count

    response = _openai().chat.completions.create(
        model="gpt-4o",
        temperature=0.7,
        max_tokens=16384,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a content expansion specialist. Your job is to ADD new, "
                    "substantive sections to an existing blog post to increase its word count. "
                    "You must NOT rewrite, shorten, or remove any existing content. "
                    "Keep the same brand voice: calm, minimal, philosophical. "
                    "No FAQ sections. No generic CTA paragraphs."
                ),
            },
            {
                "role": "user",
                "content": f"""The blog post below is {current_word_count} words. It needs to be at least {target_word_count} words.
You must add approximately {words_needed}+ words of NEW content.

Title: {title}
Focus keyphrase: {focus_keyphrase}

EXISTING CONTENT (do NOT remove or rewrite any of this):
{content}

INSTRUCTIONS:
1. Keep ALL existing content exactly as-is
2. Add 2–3 NEW <h2> sections with 2–3 paragraphs each (or expand existing thin sections with new <h3> subsections)
3. New content should add: research citations (with hyperlinks), real-world examples, ingredient science, practical guidance, or deeper analysis
4. Weave the focus keyphrase naturally into the new sections (1–2 times)
5. Maintain the same tone and HTML formatting as the existing content
6. Insert new sections BEFORE the final closing paragraph/sentence

Return ONLY valid JSON:
{{"content": "the full HTML body with existing + new content combined"}}""",
            },
        ],
    )

    raw = response.choices[0].message.content
    if not raw:
        raise RuntimeError("Expand content: empty response")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError(f"Expand content: invalid JSON: {raw[:200]}")

    expanded = parsed.get("content", "")
    if not isinstance(expanded, str) or not expanded.strip():
        raise RuntimeError("Expand content: missing content in response")

    return expanded.strip()


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

    word_count = data.get("word_count", 0)
    word_count = max(0, round(float(word_count))) if isinstance(word_count, (int, float)) else 0

    flagged_issues = data.get("flagged_issues", [])
    if not isinstance(flagged_issues, list):
        flagged_issues = []

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
        word_count=word_count,
        flagged_issues=[str(i) for i in flagged_issues],
        revision_notes=revision_notes.strip(),
    )
