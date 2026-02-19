import OpenAI from "openai";
import { BRAND_CONTEXT } from "@/prompts/brandContext";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TopicSuggestion {
  topic: string;
  focus_keyphrase: string;
  keywords: string[];
  content_pillar: string;
}

// ─── Content pillars ─────────────────────────────────────────────────────────

const CONTENT_PILLARS = [
  "ingredient_science — beeswax, honey, natural ingredients, research-backed benefits",
  "ritual_mindfulness — slow living, intentional routines, presence, pause",
  "premium_positioning — quality, craft, limited edition, artisan value",
  "natural_education — sourcing, purity, certifications, ingredient transparency",
  "lifestyle_intentionality — thoughtful consumption, human connection, anti-hustle",
];

// ─── Keyword clusters to target ───────────────────────────────────────────────

const KEYWORD_CLUSTERS = [
  // Ingredient science
  "beeswax lip balm benefits", "beeswax properties skin", "beeswax vs petroleum jelly",
  "natural lip balm ingredients", "beeswax moisturiser benefits", "honey lip treatment",
  "organic beeswax skincare", "natural emollient for lips", "lip barrier repair",

  // Lip care / product
  "best natural lip balm", "hydrating lip balm", "lip balm for dry chapped lips",
  "long lasting lip balm", "clean beauty lip care", "minimalist lip care",
  "daily lip care routine", "winter lip care tips", "lip moisture retention",

  // Mindfulness / ritual
  "mindful skincare routine", "slow beauty rituals", "intentional self-care",
  "skincare as meditation", "daily pause routine", "mindfulness morning routine",
  "present-moment beauty", "stress and skin health", "self-care philosophy",

  // Natural / clean beauty
  "clean beauty ingredients", "non-toxic lip balm", "sustainable beauty products",
  "handmade beauty products", "small batch skincare", "minimal ingredient skincare",
  "fragrance-free lip balm", "EWG verified skincare", "natural chapstick alternatives",

  // Lifestyle / philosophy
  "keeping humans human AI world", "analog rituals digital age", "slow living beauty",
  "intentional purchasing", "quality over quantity skincare", "human touch in beauty",
  "artisan beauty products", "limited edition skincare", "handcrafted personal care",
];

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function runTopicAgent(
  count: number,
  existingTopics: string[] = []
): Promise<TopicSuggestion[]> {
  const avoidList =
    existingTopics.length > 0
      ? `\n\nTopics already in use — DO NOT duplicate or closely overlap:\n${existingTopics.map((t) => `- ${t}`).join("\n")}`
      : "";

  const system = `You are an SEO strategist for Jesse A. Eisenbalm, a premium beeswax lip balm brand.

${BRAND_CONTEXT}

CONTENT PILLARS (balance suggestions across all 5):
${CONTENT_PILLARS.map((p, i) => `${i + 1}. ${p}`).join("\n")}

HIGH-VALUE KEYWORD CLUSTERS TO TARGET:
${KEYWORD_CLUSTERS.map((k) => `- ${k}`).join("\n")}

Your job: Generate SEO-optimised blog topic + focus keyphrase pairs. Each topic must:
- Target a real search query (lip balm, beeswax, lip care, mindfulness, clean beauty, etc.)
- Have clear search intent (informational or commercial)
- Align with the brand's calm, philosophical, minimal tone
- Offer genuine value to the reader
- Be unique — no overlap with existing topics

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "topics": [
    {
      "topic": "string (descriptive blog topic title idea)",
      "focus_keyphrase": "string (2–4 word SEO keyphrase)",
      "keywords": ["string", "string", "string"],
      "content_pillar": "string (one of: ingredient_science | ritual_mindfulness | premium_positioning | natural_education | lifestyle_intentionality)"
    }
  ]
}`;

  const user = `Generate ${count} unique, SEO-optimised blog topic ideas for the Jesse A. Eisenbalm brand.

Requirements:
- Spread topics across all 5 content pillars (roughly equal distribution)
- Prioritise keyphrases with informational or commercial intent
- Mix broad awareness topics (e.g. "beeswax lip balm benefits") with niche long-tail topics (e.g. "beeswax vs shea butter for lips")${avoidList}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.85,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("Topic agent returned empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Topic agent returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  return validateTopicSuggestions(parsed);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateTopicSuggestions(data: unknown): TopicSuggestion[] {
  if (typeof data !== "object" || data === null) {
    throw new Error("Topic agent: response is not an object");
  }

  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.topics)) {
    throw new Error("Topic agent: response missing topics array");
  }

  return d.topics.map((item: unknown, i: number) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Topic agent: item ${i} is not an object`);
    }
    const t = item as Record<string, unknown>;

    if (typeof t.topic !== "string" || !t.topic.trim()) {
      throw new Error(`Topic agent: item ${i} missing topic`);
    }
    if (typeof t.focus_keyphrase !== "string" || !t.focus_keyphrase.trim()) {
      throw new Error(`Topic agent: item ${i} missing focus_keyphrase`);
    }

    return {
      topic: String(t.topic).trim(),
      focus_keyphrase: String(t.focus_keyphrase).trim(),
      keywords: Array.isArray(t.keywords) ? t.keywords.map(String) : [],
      content_pillar:
        typeof t.content_pillar === "string"
          ? t.content_pillar
          : "lifestyle_intentionality",
    };
  });
}
