"""Image agent — Gemini image generation + upload."""
from __future__ import annotations

import logging
import os
import random
import re

from google import genai
from google.genai import types

from services.upload_api import upload_image

logger = logging.getLogger(__name__)
_client: genai.Client | None = None


def _gemini() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


_MODEL = "gemini-2.0-flash-preview-image-generation"

# ── Product specification ──────────────────────────────────────────────────────

_PRODUCT_SPEC = """Jesse A. Eisenbalm lip balm tube:
- Cream/ivory white tube (#FAF8F3), matte smooth finish, approx 2.5" long
- Ribbed cap with subtle hexagonal honeycomb texture
- "JESSE A. EISENBALM" in vertical black monospace uppercase text
- Gold honeycomb cluster logo (7–9 hexagons) positioned below the brand name
- Small, premium, hand-numbered limited edition
- Floats slightly above the surface with a soft shadow beneath"""

_LIGHTING = [
    "golden hour sidelight with long warm shadows",
    "diffused overcast window light, calm and even",
    "soft top-down studio light, clean and serene",
    "cool morning light, pale and still",
    "dramatic raking light revealing surface texture",
    "warm candlelight, intimate and unhurried",
]

_SURFACES = [
    "white Carrara marble with fine grey veining",
    "pale linen fabric, softly creased",
    "raw pale concrete with micro-texture",
    "unfinished bleached oak wood grain",
    "matte cream-black slate, subtle sheen",
    "aged parchment, warm ivory tone",
    "smooth brushed ceramic, off-white",
]

_SCENES: dict[str, list[str]] = {
    "product_hero": [
        "product tube centered, extreme close-up revealing label and honeycomb logo detail",
        "product lying on its side surrounded by dried botanicals and raw beeswax shards",
        "product flat lay overhead, minimal, generous negative space",
        "product leaning against a small honey jar, amber and cream tones",
        "two product tubes arranged in a geometric cross, symmetrical composition",
        "product in soft focus background, honey drip in sharp foreground",
    ],
    "natural_texture": [
        "macro close-up of natural honeycomb cells, warm amber and gold, shallow depth of field",
        "chunk of raw beeswax with warm amber glow, tactile macro photography",
        "dried lavender sprigs on cream linen, botanical stillness",
        "beeswax melting into a warm amber pool, abstract texture study",
        "pressed dried flowers on cream surface, archival botanical quality",
        "morning dew on a single green botanical leaf, macro photography",
        "single ingredient — chamomile, beeswax, honey — arranged in a minimal pattern",
    ],
    "lifestyle_moment": [
        "open journal and ceramic mug on a wooden desk, morning ritual",
        "hands resting open on a worn wooden desk, quiet pause",
        "single lit candle in dim warm light, presence over productivity",
        "a worn hardcover book beside the product, intellectual ritual",
        "still glass of water in morning light, clarity and simplicity",
        "slow Sunday morning tableau — product, mug, soft shadow",
    ],
    "abstract_mood": [
        "long shadow of a single object stretching across clean cream surface",
        "light through frosted glass casting soft geometric shapes",
        "water surface with abstract light reflections and subtle ripples",
        "crumpled cream paper with soft dramatic shadows, texture study",
        "macro of natural material — bark, stone, or dried petal — extreme detail",
        "smoke wisps rising slowly against dark muted background, ethereal",
    ],
}

# ── Mood detection ─────────────────────────────────────────────────────────────

_MOOD_MAP = {
    "mindfulness":  re.compile(r"meditat|mindful|breath|pause|slow|present|ritual|calm|still|quiet"),
    "productivity": re.compile(r"productiv|focus|work|creat|routine|habit|morning|intention|discipline"),
    "philosophy":   re.compile(r"human|philosoph|ai|technolog|meaning|purpose|exist|authentic|real"),
    "nature":       re.compile(r"nature|season|forest|beeswax|honey|botanical|ingredient|plant|organic"),
    "skincare":     re.compile(r"lip|skin|balanc|moistur|dry|chap|care|balm|beauty|wellness|hydrat"),
}

_SCENE_MAP: dict[str, list[str]] = {
    "mindfulness":  ["lifestyle_moment", "abstract_mood", "natural_texture"],
    "productivity": ["lifestyle_moment", "product_hero"],
    "philosophy":   ["abstract_mood", "lifestyle_moment"],
    "nature":       ["natural_texture", "product_hero"],
    "skincare":     ["product_hero", "natural_texture"],
    "general":      ["product_hero", "natural_texture", "lifestyle_moment", "abstract_mood"],
}


def _detect_mood(title: str, excerpt: str) -> str:
    text = f"{title} {excerpt}".lower()
    for mood, pattern in _MOOD_MAP.items():
        if pattern.search(text):
            return mood
    return "general"


# ── Agent ──────────────────────────────────────────────────────────────────────

def run_image_agent(title: str, excerpt: str) -> str:
    """Generate a cover image with Gemini and return its public URL."""
    mood = _detect_mood(title, excerpt)
    scene_key = random.choice(_SCENE_MAP[mood])
    scene = random.choice(_SCENES[scene_key])
    lighting = random.choice(_LIGHTING)
    surface = random.choice(_SURFACES)
    include_product = scene_key == "product_hero" or random.random() < 0.5

    prompt = _build_prompt(title, scene, lighting, surface, include_product)

    logger.info("[image] calling Gemini model=%s mood=%s scene=%s", _MODEL, mood, scene_key)

    response = _gemini().models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    # Log full response structure for debugging
    candidates = response.candidates or []
    logger.info("[image] candidates=%d", len(candidates))
    for ci, candidate in enumerate(candidates):
        finish = getattr(candidate, "finish_reason", None)
        parts = candidate.content.parts if candidate.content else []
        logger.info("[image] candidate[%d] finish_reason=%s parts=%d", ci, finish, len(parts or []))
        for pi, part in enumerate(parts or []):
            has_inline = part.inline_data is not None
            text_preview = repr(part.text[:80]) if getattr(part, "text", None) else None
            logger.info("[image] candidate[%d] part[%d] inline_data=%s text=%s", ci, pi, has_inline, text_preview)

    # Extract the first image part from the response
    image_bytes: bytes | None = None
    mime_type = "image/png"
    for candidate in candidates:
        for part in (candidate.content.parts if candidate.content else []) or []:
            if part.inline_data is not None:
                image_bytes = part.inline_data.data
                mime_type = part.inline_data.mime_type or "image/png"
                logger.info("[image] found image inline_data mime=%s bytes=%d", mime_type, len(image_bytes) if image_bytes else 0)
                break
        if image_bytes:
            break

    if not image_bytes:
        raise RuntimeError("Image agent: no image returned from Gemini")

    return upload_image(image_bytes, mime_type)


def _build_prompt(
    title: str,
    scene: str,
    lighting: str,
    surface: str,
    include_product: bool,
) -> str:
    product_block = f"\n\nPRODUCT (must appear in frame):\n{_PRODUCT_SPEC}" if include_product else ""

    return f"""Cover image for a blog post: "{title}"

SCENE: {scene}
SURFACE: {surface}
LIGHTING: {lighting}{product_block}

VISUAL STYLE:
- Minimal luxury editorial — high-end skincare brand meets thoughtful design magazine
- Muted warm palette: cream (#FAF8F3), warm beige, soft black, honey gold accents
- No text overlays, no people, no faces
- Cinematic stillness — the mood of a slow, intentional Sunday morning
- Photographic realism, not illustration or graphic design
- 16:9 aspect ratio, full bleed, no borders or vignette"""
