import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPost, type PostPayload } from "@/services/blogApi";

const MOCK_PAYLOAD: PostPayload = {
  title: "Why Beeswax Lip Balm Is the Last Human Ritual",
  excerpt: "A short excerpt about the ritual of beeswax lip balm and presence.",
  content: "<h2>The Ritual</h2><p>Content here.</p>",
  author: "Jesse A. Eisenbalm",
  cover_image: "https://example.com/image.jpg",
  tags: ["mindfulness", "ritual"],
  published: true,
};

const MOCK_RESPONSE = {
  post: {
    id: "abc-123",
    slug: "why-beeswax-lip-balm",
    title: MOCK_PAYLOAD.title,
    created_at: "2024-01-01T00:00:00Z",
  },
};

describe("createPost", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.BLOG_API_KEY = "test-api-key";
    process.env.BLOG_API_URL = "https://jesse-eisenbalm-server.vercel.app";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("POSTs to /api/posts and returns post data", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RESPONSE,
    } as Response);

    const result = await createPost(MOCK_PAYLOAD);

    expect(result.post.id).toBe("abc-123");
    expect(result.post.slug).toBe("why-beeswax-lip-balm");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://jesse-eisenbalm-server.vercel.app/api/posts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-api-key",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("throws on non-OK response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Invalid API key",
    } as Response);

    await expect(createPost(MOCK_PAYLOAD)).rejects.toThrow(
      "Blog API error: 401 Unauthorized"
    );
  });

  it("throws when BLOG_API_KEY is not set", async () => {
    delete process.env.BLOG_API_KEY;

    await expect(createPost(MOCK_PAYLOAD)).rejects.toThrow(
      "BLOG_API_KEY environment variable is not set"
    );
  });

  it("throws when response is missing post.id", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ post: {} }),
    } as Response);

    await expect(createPost(MOCK_PAYLOAD)).rejects.toThrow(
      "Blog API response missing post.id"
    );
  });
});
