"""Topic agent — generates SEO blog topic/keyphrase pairs for the queue."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from openai import OpenAI

from prompts.brand_context import BRAND_CONTEXT

_client: OpenAI | None = None


def _openai() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


@dataclass
class TopicSuggestion:
    topic: str
    focus_keyphrase: str
    keywords: list[str] = field(default_factory=list)
    content_pillar: str = "lifestyle_intentionality"


# ── Content pillars ────────────────────────────────────────────────────────────

_CONTENT_PILLARS = [
    "ingredient_science — beeswax, honey, natural ingredients, research-backed benefits",
    "ritual_mindfulness — slow living, intentional routines, presence, pause",
    "premium_positioning — quality, craft, limited edition, artisan value",
    "natural_education — sourcing, purity, certifications, ingredient transparency",
    "lifestyle_intentionality — thoughtful consumption, human connection, anti-hustle",
]

# ── Keyword clusters ───────────────────────────────────────────────────────────

_KEYWORD_CLUSTERS = [
    # Ingredient science
    "beeswax lip balm benefits", "beeswax properties skin", "beeswax vs petroleum jelly",
    "natural lip balm ingredients", "beeswax moisturiser benefits", "honey lip treatment",
    "organic beeswax skincare", "natural emollient for lips", "lip barrier repair",
    # Lip care / product
    "best natural lip balm", "hydrating lip balm", "lip balm for dry chapped lips",
    "long lasting lip balm", "clean beauty lip care", "minimalist lip care",
    "daily lip care routine", "winter lip care tips", "lip moisture retention",
    # Mindfulness / ritual
    "mindful skincare routine", "slow beauty rituals", "intentional self-care",
    "skincare as meditation", "daily pause routine", "mindfulness morning routine",
    "present-moment beauty", "stress and skin health", "self-care philosophy",
    # Natural / clean beauty
    "clean beauty ingredients", "non-toxic lip balm", "sustainable beauty products",
    "handmade beauty products", "small batch skincare", "minimal ingredient skincare",
    "fragrance-free lip balm", "EWG verified skincare", "natural chapstick alternatives",
    # Lifestyle / philosophy
    "keeping humans human AI world", "analog rituals digital age", "slow living beauty",
    "intentional purchasing", "quality over quantity skincare", "human touch in beauty",
    "artisan beauty products", "limited edition skincare", "handcrafted personal care",
]


def run_topic_agent(
    count: int,
    existing_topics: list[str] | None = None,
) -> list[TopicSuggestion]:
    avoid = ""
    if existing_topics:
        lines = "\n".join(f"- {t}" for t in existing_topics)
        avoid = f"\n\nTopics already in use — DO NOT duplicate or closely overlap:\n{lines}"

    pillars_str = "\n".join(f"{i+1}. {p}" for i, p in enumerate(_CONTENT_PILLARS))
    clusters_str = "\n".join(f"- {k}" for k in _KEYWORD_CLUSTERS)

    system = f"""You are an SEO strategist for Jesse A. Eisenbalm, a premium beeswax lip balm brand.

{BRAND_CONTEXT}

CONTENT PILLARS (balance suggestions across all 5):
{pillars_str}

HIGH-VALUE KEYWORD CLUSTERS TO TARGET:
{clusters_str}

Your job: Generate SEO-optimised blog topic + focus keyphrase pairs. Each topic must:
- Target a real search query (lip balm, beeswax, lip care, mindfulness, clean beauty, etc.)
- Have clear search intent (informational or commercial)
- Align with the brand's calm, philosophical, minimal tone
- Offer genuine value to the reader
- Be unique — no overlap with existing topics

Return ONLY valid JSON — no markdown fences, no extra text:
{{
  "topics": [
    {{
      "topic": "string (descriptive blog topic title idea)",
      "focus_keyphrase": "string (2–4 word SEO keyphrase)",
      "keywords": ["string", "string", "string"],
      "content_pillar": "string (one of: ingredient_science | ritual_mindfulness | premium_positioning | natural_education | lifestyle_intentionality)"
    }}
  ]
}}"""

    user = (
        f"Generate {count} unique, SEO-optimised blog topic ideas for the Jesse A. Eisenbalm brand.\n\n"
        "Requirements:\n"
        "- Spread topics across all 5 content pillars (roughly equal distribution)\n"
        "- Prioritise keyphrases with informational or commercial intent\n"
        f"- Mix broad awareness topics with niche long-tail topics{avoid}"
    )

    response = _openai().chat.completions.create(
        model="gpt-4o",
        temperature=0.85,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )

    raw = response.choices[0].message.content
    if not raw:
        raise RuntimeError("Topic agent returned empty response")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError(f"Topic agent returned invalid JSON: {raw[:200]}")

    return _validate(parsed)


def _validate(data: object) -> list[TopicSuggestion]:
    if not isinstance(data, dict):
        raise RuntimeError("Topic agent: response is not an object")

    topics = data.get("topics")
    if not isinstance(topics, list):
        raise RuntimeError("Topic agent: response missing topics array")

    results: list[TopicSuggestion] = []
    for i, item in enumerate(topics):
        if not isinstance(item, dict):
            raise RuntimeError(f"Topic agent: item {i} is not an object")

        topic = item.get("topic", "")
        if not isinstance(topic, str) or not topic.strip():
            raise RuntimeError(f"Topic agent: item {i} missing topic")

        focus_keyphrase = item.get("focus_keyphrase", "")
        if not isinstance(focus_keyphrase, str) or not focus_keyphrase.strip():
            raise RuntimeError(f"Topic agent: item {i} missing focus_keyphrase")

        keywords = item.get("keywords", [])
        results.append(TopicSuggestion(
            topic=topic.strip(),
            focus_keyphrase=focus_keyphrase.strip(),
            keywords=[str(k) for k in keywords] if isinstance(keywords, list) else [],
            content_pillar=str(item.get("content_pillar", "lifestyle_intentionality")),
        ))

    return results
