"""Image agent — Gemini / DALL-E image generation + upload."""
from __future__ import annotations

import base64
import logging
import os
import random
import re

from services.upload_api import upload_image

logger = logging.getLogger(__name__)

# Gemini models to try in order (Google rotates these frequently)
_GEMINI_MODELS = [
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash-exp-image-generation",
]


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


# ── Gemini image generation ───────────────────────────────────────────────────

def _try_gemini(prompt: str, mood: str, scene_key: str) -> bytes | None:
    """Try Gemini models for image generation. Returns image bytes or None."""
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        logger.warning("[image] google-genai not installed, skipping Gemini")
        return None

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("[image] GEMINI_API_KEY not set, skipping Gemini")
        return None

    client = genai.Client(api_key=api_key)

    for model in _GEMINI_MODELS:
        try:
            logger.info("[image] trying Gemini model=%s mood=%s scene=%s", model, mood, scene_key)
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                ),
            )

            for candidate in response.candidates or []:
                for part in (candidate.content.parts if candidate.content else []) or []:
                    inline = getattr(part, "inline_data", None)
                    if inline and inline.data:
                        raw = inline.data
                        image_bytes = raw if isinstance(raw, bytes) else bytes(raw)
                        logger.info("[image] Gemini success model=%s bytes=%d", model, len(image_bytes))
                        return image_bytes
        except Exception as exc:
            logger.warning("[image] Gemini model=%s failed: %s", model, exc)
            continue

    return None


# ── DALL-E 3 fallback ─────────────────────────────────────────────────────────

def _try_dalle(prompt: str) -> bytes | None:
    """Try DALL-E 3 for image generation. Returns image bytes or None."""
    try:
        from openai import OpenAI
    except ImportError:
        logger.warning("[image] openai not installed, skipping DALL-E")
        return None

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("[image] OPENAI_API_KEY not set, skipping DALL-E")
        return None

    try:
        logger.info("[image] trying DALL-E 3 fallback")
        client = OpenAI(api_key=api_key)
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1792x1024",
            quality="standard",
            response_format="b64_json",
            n=1,
        )

        b64_data = response.data[0].b64_json
        if b64_data:
            image_bytes = base64.b64decode(b64_data)
            logger.info("[image] DALL-E 3 success bytes=%d", len(image_bytes))
            return image_bytes
    except Exception as exc:
        logger.warning("[image] DALL-E 3 failed: %s", exc)

    return None


# ── Agent ──────────────────────────────────────────────────────────────────────

def run_image_agent(title: str, excerpt: str) -> str:
    """Generate a cover image and return its public URL."""
    mood = _detect_mood(title, excerpt)
    scene_key = random.choice(_SCENE_MAP[mood])
    scene = random.choice(_SCENES[scene_key])
    lighting = random.choice(_LIGHTING)
    surface = random.choice(_SURFACES)
    include_product = scene_key == "product_hero" or random.random() < 0.5

    prompt = _build_prompt(title, scene, lighting, surface, include_product)

    # 1. Try Gemini models first
    image_bytes = _try_gemini(prompt, mood, scene_key)

    # 2. Fall back to DALL-E 3
    if image_bytes is None:
        image_bytes = _try_dalle(prompt)

    if image_bytes is None:
        raise RuntimeError("Image agent: all providers failed (Gemini + DALL-E 3)")

    return upload_image(image_bytes, "image/png")


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
