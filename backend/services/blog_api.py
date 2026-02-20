"""Create posts on the Jesse A. Eisenbalm blog API."""
from __future__ import annotations

import os
from dataclasses import dataclass

import httpx


@dataclass
class PostResponse:
    id: str
    slug: str
    title: str
    created_at: str


def create_post(
    title: str,
    excerpt: str,
    content: str,
    author: str,
    cover_image: str,
    tags: list[str],
    published: bool,
) -> PostResponse:
    api_key = os.environ["BLOG_API_KEY"]
    api_url = os.environ.get("BLOG_API_URL", "https://jesse-eisenbalm-server.vercel.app")

    response = httpx.post(
        f"{api_url}/api/posts",
        json={
            "title": title,
            "excerpt": excerpt,
            "content": content,
            "author": author,
            "cover_image": cover_image,
            "tags": tags,
            "published": published,
        },
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
        },
        timeout=30.0,
    )

    if not response.is_success:
        raise RuntimeError(
            f"Blog API error: {response.status_code} {response.reason_phrase} — {response.text[:300]}"
        )

    data = response.json()
    post = data.get("post") or {}
    if not post.get("id"):
        raise RuntimeError("Blog API response missing post.id")

    return PostResponse(
        id=post["id"],
        slug=post.get("slug", ""),
        title=post.get("title", ""),
        created_at=post.get("created_at", ""),
    )
