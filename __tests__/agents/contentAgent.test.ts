import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures mockCreate is available inside the vi.mock factory (both are hoisted)
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

import { runContentAgent } from "@/agents/contentAgent";

const VALID_DRAFT = {
  title: "Why Beeswax Lip Balm Is the Last Human Ritual",
  excerpt:
    "In a world of screens and algorithms, applying beeswax lip balm has become a rare moment of genuine presence. Here is why this ritual matters.",
  content:
    "<h2>The Ritual of Presence</h2><p>Beeswax lip balm brings you back to the moment. <a href='https://jesseaeisenbalm.com'>Shop the balm</a>.</p>",
  tags: ["mindfulness", "ritual", "beeswax lip balm"],
  focus_keyphrase: "beeswax lip balm",
};

describe("runContentAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a valid ContentDraft on success", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(VALID_DRAFT) } }],
    });

    const result = await runContentAgent(
      "The ritual of beeswax lip balm",
      "beeswax lip balm"
    );

    expect(result.title).toBe(VALID_DRAFT.title);
    expect(result.excerpt).toBe(VALID_DRAFT.excerpt);
    expect(result.tags).toEqual(VALID_DRAFT.tags);
    expect(result.focus_keyphrase).toBe("beeswax lip balm");
  });

  it("throws when response is empty", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    await expect(
      runContentAgent("topic", "keyphrase")
    ).rejects.toThrow("Content agent returned empty response");
  });

  it("throws when response is invalid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not json" } }],
    });

    await expect(
      runContentAgent("topic", "keyphrase")
    ).rejects.toThrow("Content agent returned invalid JSON");
  });

  it("throws when title is missing", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ ...VALID_DRAFT, title: "" }) } }],
    });

    await expect(
      runContentAgent("topic", "keyphrase")
    ).rejects.toThrow("missing or empty title");
  });

  it("throws when tags array is empty", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ ...VALID_DRAFT, tags: [] }) } }],
    });

    await expect(
      runContentAgent("topic", "keyphrase")
    ).rejects.toThrow("missing or empty tags");
  });
});
