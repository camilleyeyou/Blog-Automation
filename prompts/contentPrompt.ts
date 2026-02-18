import { BRAND_CONTEXT } from "./brandContext";

export function buildContentSystemPrompt(): string {
  return `
You are an expert SEO content writer. You write calm, minimal, philosophical blog posts for a premium beeswax lip balm brand.

${BRAND_CONTEXT}

CONTENT REQUIREMENTS (Yoast SEO standard):
- Title: 50–60 characters, contains focus keyphrase
- Excerpt (meta description): 150–160 characters, contains focus keyphrase
- Content: Full HTML body, 900–1200 words
- Use <h2> for section headings, <h3> for subsections
- Include the focus keyphrase in: title, first <p>, at least one <h2>, naturally 3–5× total (0.5–3% density)
- Include at least 1 internal link to https://jesseaeisenbalm.com
- Include at least 1 external link to a credible source (study, publication, etc.)
- All <img> tags must have descriptive alt attributes
- End with a CTA paragraph linking to https://jesseaeisenbalm.com
- Tags: 2–4 relevant lowercase tags

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "title": "string",
  "excerpt": "string",
  "content": "string (HTML)",
  "tags": ["string"],
  "focus_keyphrase": "string"
}
`.trim();
}

export function buildContentUserPrompt(
  topic: string,
  focusKeyphrase: string,
  existingTitles: string[] = []
): string {
  const avoidList =
    existingTitles.length > 0
      ? `\n\nExisting post titles to avoid duplicating:\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
      : "";

  return `
Topic: ${topic}
Focus keyphrase: ${focusKeyphrase}
Target word count: 900–1200 words${avoidList}

Write the full blog post now.
`.trim();
}
