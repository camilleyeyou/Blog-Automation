"""Upload images to Supabase Storage via the blog server's upload endpoint."""
from __future__ import annotations

import os
import random
import string
import time

import httpx


def upload_image(image_bytes: bytes, mime_type: str = "image/png") -> str:
    """Upload image bytes and return the public CDN URL."""
    admin_password = os.environ["ADMIN_PASSWORD"]
    api_url = os.environ.get("BLOG_API_URL", "https://jesse-eisenbalm-server.vercel.app")

    ext = "png" if mime_type == "image/png" else ("webp" if mime_type == "image/webp" else "jpg")
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    filename = f"{int(time.time())}-{rand}.{ext}"

    response = httpx.post(
        f"{api_url}/api/admin/upload",
        headers={"x-admin-password": admin_password},
        files={"file": (filename, image_bytes, mime_type)},
        timeout=60.0,
    )

    if not response.is_success:
        raise RuntimeError(
            f"Upload failed: {response.status_code} {response.reason_phrase} — {response.text[:300]}"
        )

    data = response.json()
    url = data.get("url")
    if not url:
        raise RuntimeError("Upload response missing url field")

    return url
