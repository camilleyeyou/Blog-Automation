import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentDraft } from "@/agents/contentAgent";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

import { runRevisionAgent } from "@/agents/revisionAgent";

const MOCK_DRAFT: ContentDraft = {
  title: "Why Beeswax Lip Balm Is the Last Human Ritual",
  excerpt:
    "In a world of screens and algorithms, applying beeswax lip balm has become a rare moment of genuine presence. Here is why this ritual matters.",
  content:
    "<h2>The beeswax lip balm Ritual</h2><p>Applying beeswax lip balm is an act of presence. <a href='https://jesseaeisenbalm.com'>Shop the balm</a>. <a href='https://example.com/study'>Research</a>.</p>",
  tags: ["mindfulness", "ritual", "beeswax lip balm"],
  focus_keyphrase: "beeswax lip balm",
};

const VALID_REVISION = {
  title: "Why Beeswax Lip Balm Is the Last Human Ritual",
  excerpt:
    "In a world of screens and algorithms, applying beeswax lip balm has become a rare moment of genuine presence. Here is why this matters.",
  content: MOCK_DRAFT.content,
  tags: MOCK_DRAFT.tags,
  confidence_score: 92,
  seo_checks_passed: 13,
  revision_notes: "All 13 checks passed. Minor excerpt trim.",
};

describe("runRevisionAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a valid RevisionResult on success", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(VALID_REVISION) } }],
    });

    const result = await runRevisionAgent(MOCK_DRAFT);

    expect(result.confidence_score).toBe(92);
    expect(result.seo_checks_passed).toBe(13);
    expect(result.revision_notes).toBe("All 13 checks passed. Minor excerpt trim.");
  });

  it("clamps confidence_score to 0–100", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        { message: { content: JSON.stringify({ ...VALID_REVISION, confidence_score: 150 }) } },
      ],
    });

    const result = await runRevisionAgent(MOCK_DRAFT);
    expect(result.confidence_score).toBe(100);
  });

  it("clamps seo_checks_passed to 0–13", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        { message: { content: JSON.stringify({ ...VALID_REVISION, seo_checks_passed: 20 }) } },
      ],
    });

    const result = await runRevisionAgent(MOCK_DRAFT);
    expect(result.seo_checks_passed).toBe(13);
  });

  it("throws when confidence_score is missing", async () => {
    const bad = { ...VALID_REVISION } as Partial<typeof VALID_REVISION>;
    delete bad.confidence_score;
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(bad) } }],
    });

    await expect(runRevisionAgent(MOCK_DRAFT)).rejects.toThrow(
      "missing confidence_score"
    );
  });

  it("throws on empty response", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    await expect(runRevisionAgent(MOCK_DRAFT)).rejects.toThrow(
      "Revision agent returned empty response"
    );
  });
});
