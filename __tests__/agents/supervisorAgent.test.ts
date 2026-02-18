import { describe, it, expect, vi, beforeEach } from "vitest";
import { runPipeline } from "@/agents/supervisorAgent";

// ─── Mock all dependencies ────────────────────────────────────────────────────

vi.mock("@/agents/contentAgent", () => ({
  runContentAgent: vi.fn(),
}));

vi.mock("@/agents/revisionAgent", () => ({
  runRevisionAgent: vi.fn(),
}));

vi.mock("@/agents/imageAgent", () => ({
  runImageAgent: vi.fn(),
}));

vi.mock("@/services/blogApi", () => ({
  createPost: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  dequeueNextTopic: vi.fn(),
  updateQueueStatus: vi.fn(),
  insertLog: vi.fn(),
}));

// ─── Import mocks ─────────────────────────────────────────────────────────────

import { runContentAgent } from "@/agents/contentAgent";
import { runRevisionAgent } from "@/agents/revisionAgent";
import { runImageAgent } from "@/agents/imageAgent";
import { createPost } from "@/services/blogApi";
import {
  dequeueNextTopic,
  updateQueueStatus,
  insertLog,
} from "@/services/supabase";

const mockQueue = vi.mocked(dequeueNextTopic);
const mockContent = vi.mocked(runContentAgent);
const mockRevision = vi.mocked(runRevisionAgent);
const mockImage = vi.mocked(runImageAgent);
const mockCreate = vi.mocked(createPost);
const mockUpdateStatus = vi.mocked(updateQueueStatus);
const mockInsertLog = vi.mocked(insertLog);

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const QUEUE_ITEM = {
  id: "queue-1",
  topic: "The ritual of beeswax lip balm",
  focus_keyphrase: "beeswax lip balm",
  keywords: null,
  status: "in_progress" as const,
  created_at: "2024-01-01T00:00:00Z",
  processed_at: null,
};

const DRAFT = {
  title: "Why Beeswax Lip Balm Is the Last Human Ritual",
  excerpt:
    "Applying beeswax lip balm is an act of presence. A rare moment of genuine humanity.",
  content: "<h2>The Ritual</h2><p>Content here about beeswax lip balm.</p>",
  tags: ["mindfulness", "beeswax lip balm"],
  focus_keyphrase: "beeswax lip balm",
};

const REVISION_HIGH = {
  ...DRAFT,
  confidence_score: 90,
  seo_checks_passed: 13,
  revision_notes: "All checks passed.",
};

const REVISION_MID = {
  ...DRAFT,
  confidence_score: 75,
  seo_checks_passed: 11,
  revision_notes: "Minor issues fixed.",
};

const REVISION_LOW = {
  ...DRAFT,
  confidence_score: 60,
  seo_checks_passed: 8,
  revision_notes: "Several checks failed.",
};

const IMAGE_RESULT = { url: "https://example.com/cover.jpg" };
const POST_RESPONSE = {
  post: { id: "post-1", slug: "why-beeswax", title: DRAFT.title, created_at: "2024-01-01" },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTO_PUBLISH_THRESHOLD = "85";
    process.env.DRAFT_THRESHOLD = "70";
    mockInsertLog.mockResolvedValue({} as ReturnType<typeof insertLog> extends Promise<infer T> ? T : never);
    mockUpdateStatus.mockResolvedValue(undefined);
  });

  it("auto-publishes when confidence >= 85", async () => {
    mockQueue.mockResolvedValue(QUEUE_ITEM);
    mockContent.mockResolvedValue(DRAFT);
    mockRevision.mockResolvedValue(REVISION_HIGH);
    mockImage.mockResolvedValue(IMAGE_RESULT);
    mockCreate.mockResolvedValue(POST_RESPONSE);

    const result = await runPipeline();

    expect(result.status).toBe("success");
    expect(result.postId).toBe("post-1");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ published: true })
    );
  });

  it("saves as draft when confidence is 70–84", async () => {
    mockQueue.mockResolvedValue(QUEUE_ITEM);
    mockContent.mockResolvedValue(DRAFT);
    mockRevision.mockResolvedValue(REVISION_MID);
    mockImage.mockResolvedValue(IMAGE_RESULT);
    mockCreate.mockResolvedValue(POST_RESPONSE);

    const result = await runPipeline();

    expect(result.status).toBe("draft");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ published: false })
    );
  });

  it("holds post (no API call) when confidence < 70", async () => {
    mockQueue.mockResolvedValue(QUEUE_ITEM);
    mockContent.mockResolvedValue(DRAFT);
    mockRevision.mockResolvedValue(REVISION_LOW);

    const result = await runPipeline();

    expect(result.status).toBe("held");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockImage).not.toHaveBeenCalled();
    expect(mockUpdateStatus).toHaveBeenCalledWith("queue-1", "held", true);
  });

  it("returns error when queue is empty", async () => {
    mockQueue.mockResolvedValue(null);

    const result = await runPipeline();

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/No pending topics/);
  });

  it("handles content agent failure and logs error", async () => {
    mockQueue.mockResolvedValue(QUEUE_ITEM);
    mockContent.mockRejectedValue(new Error("OpenAI timeout"));

    const result = await runPipeline();

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/OpenAI timeout/);
    expect(mockUpdateStatus).toHaveBeenCalledWith("queue-1", "pending");
  });
});
