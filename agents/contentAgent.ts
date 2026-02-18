import OpenAI from "openai";
import {
  buildContentSystemPrompt,
  buildContentUserPrompt,
} from "@/prompts/contentPrompt";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ContentDraft {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  focus_keyphrase: string;
}

export async function runContentAgent(
  topic: string,
  focusKeyphrase: string,
  existingTitles: string[] = []
): Promise<ContentDraft> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildContentSystemPrompt() },
      {
        role: "user",
        content: buildContentUserPrompt(topic, focusKeyphrase, existingTitles),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("Content agent returned empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Content agent returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  return validateContentDraft(parsed);
}

function validateContentDraft(data: unknown): ContentDraft {
  if (typeof data !== "object" || data === null) {
    throw new Error("Content agent: response is not an object");
  }

  const d = data as Record<string, unknown>;

  if (typeof d.title !== "string" || d.title.trim() === "") {
    throw new Error("Content agent: missing or empty title");
  }
  if (typeof d.excerpt !== "string" || d.excerpt.trim() === "") {
    throw new Error("Content agent: missing or empty excerpt");
  }
  if (typeof d.content !== "string" || d.content.trim() === "") {
    throw new Error("Content agent: missing or empty content");
  }
  if (!Array.isArray(d.tags) || d.tags.length === 0) {
    throw new Error("Content agent: missing or empty tags");
  }
  if (typeof d.focus_keyphrase !== "string" || d.focus_keyphrase.trim() === "") {
    throw new Error("Content agent: missing focus_keyphrase");
  }

  return {
    title: d.title.trim(),
    excerpt: d.excerpt.trim(),
    content: d.content.trim(),
    tags: (d.tags as unknown[]).map(String),
    focus_keyphrase: (d.focus_keyphrase as string).trim(),
  };
}
