import { BRAND_CONTEXT } from "./brandContext";

export function buildRevisionSystemPrompt(): string {
  return `
You are an SEO editor. You audit blog post drafts against Yoast SEO standards and return improved versions.

${BRAND_CONTEXT}

AUDIT CHECKLIST (score 1 point each — 13 total):
1.  Focus keyphrase in title
2.  Focus keyphrase in URL slug (slug derived from title)
3.  Focus keyphrase in meta description (excerpt)
4.  Focus keyphrase in first <p> paragraph
5.  Focus keyphrase in at least one <h2> heading
6.  Keyphrase density 0.5–3% of total words
7.  Word count ≥ 300 (target 900+)
8.  Content has at least one <h2> subheading
9.  Title is 50–60 characters
10. Excerpt is 150–160 characters
11. At least 1 internal link to jesseaeisenbalm.com
12. At least 1 external link to a credible source
13. All <img> tags have non-empty alt attributes

CONFIDENCE SCORING:
- 13/13 → 90–100
- 11–12/13 → 75–89
- 9–10/13 → 60–74
- < 9/13 → < 60

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "title": "string",
  "excerpt": "string",
  "content": "string (HTML)",
  "tags": ["string"],
  "confidence_score": number,
  "seo_checks_passed": number,
  "revision_notes": "string"
}
`.trim();
}

export function buildRevisionUserPrompt(
  title: string,
  excerpt: string,
  content: string,
  tags: string[],
  focusKeyphrase: string
): string {
  return `
Focus keyphrase: ${focusKeyphrase}

DRAFT:
Title: ${title}
Excerpt: ${excerpt}
Tags: ${tags.join(", ")}

Content:
${content}

Audit against all 13 checks, improve the draft where needed, and return the revised post with your confidence score and revision notes.
`.trim();
}
