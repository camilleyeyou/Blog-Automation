import OpenAI from "openai";
import { uploadImage } from "@/services/uploadApi";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

export interface ImageResult {
  url: string;
}

// ─── Product specification ──────────────────────────────────────────────────────

const PRODUCT_SPEC = `Jesse A. Eisenbalm lip balm tube:
- Cream/ivory white tube (#FAF8F3), matte smooth finish, approx 2.5" long
- Ribbed cap with subtle hexagonal honeycomb texture
- "JESSE A. EISENBALM" in vertical black monospace uppercase text
- Gold honeycomb cluster logo (7–9 hexagons) positioned below the brand name
- Small, premium, hand-numbered limited edition
- Floats slightly above the surface with a soft shadow beneath`;

// ─── Variety systems ────────────────────────────────────────────────────────────

const LIGHTING = [
  "golden hour sidelight with long warm shadows",
  "diffused overcast window light, calm and even",
  "soft top-down studio light, clean and serene",
  "cool morning light, pale and still",
  "dramatic raking light revealing surface texture",
  "warm candlelight, intimate and unhurried",
];

const SURFACES = [
  "white Carrara marble with fine grey veining",
  "pale linen fabric, softly creased",
  "raw pale concrete with micro-texture",
  "unfinished bleached oak wood grain",
  "matte cream-black slate, subtle sheen",
  "aged parchment, warm ivory tone",
  "smooth brushed ceramic, off-white",
];

const SCENES: Record<string, string[]> = {
  product_hero: [
    "product tube centered, extreme close-up revealing label and honeycomb logo detail",
    "product lying on its side surrounded by dried botanicals and raw beeswax shards",
    "product flat lay overhead, minimal, generous negative space",
    "product leaning against a small honey jar, amber and cream tones",
    "two product tubes arranged in a geometric cross, symmetrical composition",
    "product in soft focus background, honey drip in sharp foreground",
  ],
  natural_texture: [
    "macro close-up of natural honeycomb cells, warm amber and gold, shallow depth of field",
    "chunk of raw beeswax with warm amber glow, tactile macro photography",
    "dried lavender sprigs on cream linen, botanical stillness",
    "beeswax melting into a warm amber pool, abstract texture study",
    "pressed dried flowers on cream surface, archival botanical quality",
    "morning dew on a single green botanical leaf, macro photography",
    "single ingredient — chamomile, beeswax, honey — arranged in a minimal pattern",
  ],
  lifestyle_moment: [
    "open journal and ceramic mug on a wooden desk, morning ritual",
    "hands resting open on a worn wooden desk, quiet pause",
    "single lit candle in dim warm light, presence over productivity",
    "a worn hardcover book beside the product, intellectual ritual",
    "still glass of water in morning light, clarity and simplicity",
    "slow Sunday morning tableau — product, mug, soft shadow",
  ],
  abstract_mood: [
    "long shadow of a single object stretching across clean cream surface",
    "light through frosted glass casting soft geometric shapes",
    "water surface with abstract light reflections and subtle ripples",
    "crumpled cream paper with soft dramatic shadows, texture study",
    "macro of natural material — bark, stone, or dried petal — extreme detail",
    "smoke wisps rising slowly against dark muted background, ethereal",
  ],
};

// ─── Mood detection ─────────────────────────────────────────────────────────────

type Mood = "mindfulness" | "productivity" | "philosophy" | "nature" | "skincare" | "general";
type SceneKey = keyof typeof SCENES;

function detectMood(title: string, excerpt: string): Mood {
  const text = `${title} ${excerpt}`.toLowerCase();
  if (/meditat|mindful|breath|pause|slow|present|ritual|calm|still|quiet/.test(text))
    return "mindfulness";
  if (/productiv|focus|work|creat|routine|habit|morning|intention|discipline/.test(text))
    return "productivity";
  if (/human|philosoph|ai|technolog|meaning|purpose|exist|authentic|real/.test(text))
    return "philosophy";
  if (/nature|season|forest|beeswax|honey|botanical|ingredient|plant|organic/.test(text))
    return "nature";
  if (/lip|skin|balanc|moistur|dry|chap|care|balm|beauty|wellness|hydrat/.test(text))
    return "skincare";
  return "general";
}

function pickScene(mood: Mood): SceneKey {
  const map: Record<Mood, SceneKey[]> = {
    mindfulness:  ["lifestyle_moment", "abstract_mood", "natural_texture"],
    productivity: ["lifestyle_moment", "product_hero"],
    philosophy:   ["abstract_mood", "lifestyle_moment"],
    nature:       ["natural_texture", "product_hero"],
    skincare:     ["product_hero", "natural_texture"],
    general:      ["product_hero", "natural_texture", "lifestyle_moment", "abstract_mood"],
  };
  const options = map[mood];
  return options[Math.floor(Math.random() * options.length)];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Agent ──────────────────────────────────────────────────────────────────────

export async function runImageAgent(
  title: string,
  excerpt: string
): Promise<ImageResult> {
  const mood     = detectMood(title, excerpt);
  const sceneKey = pickScene(mood);
  const scene    = pick(SCENES[sceneKey]);
  const lighting = pick(LIGHTING);
  const surface  = pick(SURFACES);

  // Always include the product for product_hero; ~50% chance for other scenes
  const includeProduct = sceneKey === "product_hero" || Math.random() < 0.5;

  const prompt = buildPrompt({ title, scene, lighting, surface, includeProduct });

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1792x1024", // 16:9
    quality: "standard",
    response_format: "b64_json",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image agent: no image data from DALL-E 3");

  const buffer = Buffer.from(b64, "base64");
  return uploadImage(buffer, "image/png");
}

// ─── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(params: {
  title: string;
  scene: string;
  lighting: string;
  surface: string;
  includeProduct: boolean;
}): string {
  const { title, scene, lighting, surface, includeProduct } = params;

  const productBlock = includeProduct
    ? `\n\nPRODUCT (must appear in frame):\n${PRODUCT_SPEC}`
    : "";

  return `Cover image for a blog post: "${title}"

SCENE: ${scene}
SURFACE: ${surface}
LIGHTING: ${lighting}${productBlock}

VISUAL STYLE:
- Minimal luxury editorial — high-end skincare brand meets thoughtful design magazine
- Muted warm palette: cream (#FAF8F3), warm beige, soft black, honey gold accents
- No text overlays, no people, no faces
- Cinematic stillness — the mood of a slow, intentional Sunday morning
- Photographic realism, not illustration or graphic design
- 16:9 aspect ratio, full bleed, no borders or vignette`;
}
