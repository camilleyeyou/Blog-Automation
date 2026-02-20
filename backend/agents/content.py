"""Content agent — generates the first SEO-optimised blog post draft."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass

from openai import OpenAI

from prompts.content_prompt import build_content_system_prompt, build_content_user_prompt

_client: OpenAI | None = None


def _openai() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


@dataclass
class ContentDraft:
    title: str
    excerpt: str
    content: str
    tags: list[str]
    focus_keyphrase: str


def run_content_agent(
    topic: str,
    focus_keyphrase: str,
    existing_titles: list[str] | None = None,
) -> ContentDraft:
    response = _openai().chat.completions.create(
        model="gpt-4o",
        temperature=0.7,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": build_content_system_prompt()},
            {"role": "user", "content": build_content_user_prompt(topic, focus_keyphrase, existing_titles)},
        ],
    )

    raw = response.choices[0].message.content
    if not raw:
        raise RuntimeError("Content agent returned empty response")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError(f"Content agent returned invalid JSON: {raw[:200]}")

    return _validate(parsed)


def _validate(data: object) -> ContentDraft:
    if not isinstance(data, dict):
        raise RuntimeError("Content agent: response is not an object")

    title = data.get("title", "")
    if not isinstance(title, str) or not title.strip():
        raise RuntimeError("Content agent: missing or empty title")

    excerpt = data.get("excerpt", "")
    if not isinstance(excerpt, str) or not excerpt.strip():
        raise RuntimeError("Content agent: missing or empty excerpt")

    content = data.get("content", "")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Content agent: missing or empty content")

    tags = data.get("tags", [])
    if not isinstance(tags, list) or len(tags) == 0:
        raise RuntimeError("Content agent: missing or empty tags")

    focus_keyphrase = data.get("focus_keyphrase", "")
    if not isinstance(focus_keyphrase, str) or not focus_keyphrase.strip():
        raise RuntimeError("Content agent: missing focus_keyphrase")

    return ContentDraft(
        title=title.strip(),
        excerpt=excerpt.strip(),
        content=content.strip(),
        tags=[str(t) for t in tags],
        focus_keyphrase=focus_keyphrase.strip(),
    )
