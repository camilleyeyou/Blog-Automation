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
    "ingredient_science — beeswax barrier repair, TEWL prevention, petrolatum-free alternatives, bio-compatible occlusion, lip tissue biology",
    "ritual_mindfulness — slow living, intentional routines, presence, pause, analog rituals, neurocosmetic grounding",
    "digital_wellness_professional — digital fatigue, cognitive load, executive wellness, knowledge worker wellbeing, screen-time recovery, workplace mindfulness",
    "lip_skinification — active ingredients, ceramides, lip barrier science, treating lips like facial skin, ingredient transparency",
    "lifestyle_intentionality — thoughtful consumption, human connection, philanthropic brand values, limited edition craft, quality over quantity",
]

# ── Keyword clusters ───────────────────────────────────────────────────────────

_KEYWORD_CLUSTERS = [
    # Ingredient science / lip biology
    "beeswax lip barrier repair", "petrolatum-free lip balm", "beeswax vs petroleum jelly lips",
    "transepidermal water loss lips", "TEWL lip care", "bio-compatible lip occlusion",
    "natural emollient for lips", "beeswax properties skin barrier", "organic beeswax skincare benefits",
    "lip tissue biology", "why lips dry out faster than skin", "sebaceous glands lips",
    # Lip skinification
    "lip skinification trend", "active ingredients lip balm", "ceramide lip balm benefits",
    "treating lips like skin", "lip barrier restoration", "petrolatum-free lip care 2026",
    "clean ingredients lip balm", "EWG verified lip balm", "fragrance-free lip treatment",
    # Digital wellness / executive audience
    "digital fatigue recovery ritual", "executive grounding ritual", "analog ritual digital age",
    "tactile grounding tool workplace", "mindful break from screens", "neurocosmetic lip balm",
    "digital detox practice professional", "cognitive load management ritual",
    "workplace mindfulness tools", "knowledge worker wellness", "screen time lip dryness",
    "lip care for office workers", "climate-controlled office skin care",
    # Mindfulness / ritual
    "mindful skincare routine", "intentional daily ritual", "slow beauty rituals",
    "skincare as meditation", "present-moment grounding practice", "mindfulness morning routine",
    "sensory grounding techniques", "stress and skin health connection",
    # Brand / product
    "limited edition lip balm", "hand-numbered beauty products", "small batch lip care",
    "mindful gift for executives", "premium wellness gift professional", "charity lip balm",
    "philanthropic beauty brand", "Jesse A. Eisenbalm", "human-centered skincare",
    # Natural / clean beauty
    "clean beauty lip care", "non-toxic lip balm ingredients", "sustainable lip care",
    "minimalist ingredient skincare", "handmade artisan lip balm", "natural chapstick alternatives",
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

    system = f"""You are a GEO (Generative Engine Optimization) strategist for Jesse A. Eisenbalm, a premium beeswax lip balm brand. Your goal is to generate blog topics that rank on Google AND get cited by AI search engines like ChatGPT, Perplexity, and Gemini.

{BRAND_CONTEXT}

CONTENT PILLARS (balance suggestions across all 5):
{pillars_str}

HIGH-VALUE KEYWORD & SEMANTIC CLUSTERS TO TARGET:
{clusters_str}

GEO TOPIC PRINCIPLES:
- Target "fan-out queries" — topics that answer the sub-questions AI engines use when synthesising answers
- Prioritise topics that occupy clear semantic territory the brand owns (digital fatigue, petrolatum-free beeswax, executive wellness ritual)
- Each topic should have a clear implicit question an AI would answer ("Is beeswax better than petroleum jelly for lip health?" → full post answering this)
- Include both informational (educational) and commercial (product-intent) topics
- The brand's philanthropic angle (100% charity proceeds) is a citable trust signal — include topics that can feature it naturally

Your job: Generate SEO + GEO-optimised blog topic + focus keyphrase pairs. Each topic must:
- Target a real conversational search query (lip balm, beeswax, digital fatigue, executive wellness, lip skinification, etc.)
- Have clear search intent (informational or commercial)
- Align with the brand's calm, philosophical, minimal tone
- Offer genuine value to the reader — not a sales pitch
- Be unique — no overlap with existing topics

Return ONLY valid JSON — no markdown fences, no extra text:
{{
  "topics": [
    {{
      "topic": "string (descriptive blog topic title idea)",
      "focus_keyphrase": "string (2–4 word SEO keyphrase)",
      "keywords": ["string", "string", "string"],
      "content_pillar": "string (one of: ingredient_science | ritual_mindfulness | digital_wellness_professional | lip_skinification | lifestyle_intentionality)"
    }}
  ]
}}"""

    user = (
        f"Generate {count} unique, SEO + GEO-optimised blog topic ideas for the Jesse A. Eisenbalm brand.\n\n"
        "Requirements:\n"
        "- Spread topics across all 5 content pillars (roughly equal distribution)\n"
        "- At least 20% of topics should target the digital_wellness_professional pillar (executives, knowledge workers, digital fatigue)\n"
        "- At least 15% should target lip_skinification (ceramides, active ingredients, barrier science)\n"
        "- Mix broad awareness topics with niche long-tail topics\n"
        f"- Prioritise keyphrases an AI would use when someone asks about lip care, digital wellness, or mindful rituals{avoid}"
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
