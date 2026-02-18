import OpenAI from "openai";
import {
  buildRevisionSystemPrompt,
  buildRevisionUserPrompt,
} from "@/prompts/revisionPrompt";
import type { ContentDraft } from "./contentAgent";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface RevisionResult {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  confidence_score: number;
  seo_checks_passed: number;
  revision_notes: string;
}

export async function runRevisionAgent(
  draft: ContentDraft
): Promise<RevisionResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildRevisionSystemPrompt() },
      {
        role: "user",
        content: buildRevisionUserPrompt(
          draft.title,
          draft.excerpt,
          draft.content,
          draft.tags,
          draft.focus_keyphrase
        ),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("Revision agent returned empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Revision agent returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  return validateRevisionResult(parsed);
}

function validateRevisionResult(data: unknown): RevisionResult {
  if (typeof data !== "object" || data === null) {
    throw new Error("Revision agent: response is not an object");
  }

  const d = data as Record<string, unknown>;

  if (typeof d.title !== "string" || d.title.trim() === "") {
    throw new Error("Revision agent: missing title");
  }
  if (typeof d.excerpt !== "string" || d.excerpt.trim() === "") {
    throw new Error("Revision agent: missing excerpt");
  }
  if (typeof d.content !== "string" || d.content.trim() === "") {
    throw new Error("Revision agent: missing content");
  }
  if (!Array.isArray(d.tags)) {
    throw new Error("Revision agent: missing tags");
  }
  if (typeof d.confidence_score !== "number") {
    throw new Error("Revision agent: missing confidence_score");
  }
  if (typeof d.seo_checks_passed !== "number") {
    throw new Error("Revision agent: missing seo_checks_passed");
  }
  if (typeof d.revision_notes !== "string") {
    throw new Error("Revision agent: missing revision_notes");
  }

  return {
    title: d.title.trim(),
    excerpt: d.excerpt.trim(),
    content: d.content.trim(),
    tags: (d.tags as unknown[]).map(String),
    confidence_score: Math.min(100, Math.max(0, Math.round(d.confidence_score))),
    seo_checks_passed: Math.min(13, Math.max(0, Math.round(d.seo_checks_passed))),
    revision_notes: (d.revision_notes as string).trim(),
  };
}
