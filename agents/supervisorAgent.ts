import { runContentAgent, type ContentDraft } from "./contentAgent";
import { runRevisionAgent, type RevisionResult } from "./revisionAgent";
import { runImageAgent } from "./imageAgent";
import { createPost } from "@/services/blogApi";
import {
  dequeueNextTopic,
  updateQueueStatus,
  insertLog,
  type QueueItem,
} from "@/services/supabase";

const AUTO_PUBLISH_THRESHOLD = Number(process.env.AUTO_PUBLISH_THRESHOLD ?? 85);
const DRAFT_THRESHOLD = Number(process.env.DRAFT_THRESHOLD ?? 70);
const MAX_RETRIES = 2;

export type PipelineStatus = "success" | "draft" | "held" | "error";

export interface PipelineResult {
  status: PipelineStatus;
  queueItem: QueueItem | null;
  postId?: string;
  slug?: string;
  confidence_score?: number;
  seo_checks_passed?: number;
  revision_notes?: string;
  error?: string;
}

/**
 * Run the full pipeline for the next queued topic.
 * Dequeues → generates → revises → images → publishes or holds.
 */
export async function runPipeline(): Promise<PipelineResult> {
  // 1. Dequeue next topic
  const queueItem = await dequeueNextTopic();
  if (!queueItem) {
    return { status: "error", queueItem: null, error: "No pending topics in queue" };
  }

  const topic = queueItem.topic;
  const focusKeyphrase = queueItem.focus_keyphrase ?? topic;

  try {
    // 2. Generate content draft (with retries)
    const draft = await withRetry(() =>
      runContentAgent(topic, focusKeyphrase)
    );

    // 3. Revise + SEO audit (with retries)
    const revision = await withRetry(() => runRevisionAgent(draft));

    // 4. Hold if below threshold — do not generate image or POST
    if (revision.confidence_score < DRAFT_THRESHOLD) {
      await updateQueueStatus(queueItem.id, "held", true);
      await insertLog({
        queue_id: queueItem.id,
        post_id: null,
        status: "held",
        confidence_score: revision.confidence_score,
        seo_checks_passed: revision.seo_checks_passed,
        revision_notes: revision.revision_notes,
        error_message: null,
      });
      return {
        status: "held",
        queueItem,
        confidence_score: revision.confidence_score,
        seo_checks_passed: revision.seo_checks_passed,
        revision_notes: revision.revision_notes,
      };
    }

    // 5. Generate + upload cover image (with retries)
    const image = await withRetry(() =>
      runImageAgent(revision.title, revision.excerpt)
    );

    // 6. Validate payload
    validatePayload(revision, image.url);

    // 7. Determine publish mode
    const published = revision.confidence_score >= AUTO_PUBLISH_THRESHOLD;

    // 8. POST to blog API
    const postResponse = await withRetry(() =>
      createPost({
        title: revision.title,
        excerpt: revision.excerpt,
        content: revision.content,
        author: "Jesse A. Eisenbalm",
        cover_image: image.url,
        tags: revision.tags,
        published,
      })
    );

    // 9. Update queue + log
    await updateQueueStatus(queueItem.id, "published", true);
    const logStatus: PipelineStatus = published ? "success" : "draft";
    await insertLog({
      queue_id: queueItem.id,
      post_id: postResponse.post.id,
      status: logStatus,
      confidence_score: revision.confidence_score,
      seo_checks_passed: revision.seo_checks_passed,
      revision_notes: revision.revision_notes,
      error_message: null,
    });

    return {
      status: logStatus,
      queueItem,
      postId: postResponse.post.id,
      slug: postResponse.post.slug,
      confidence_score: revision.confidence_score,
      seo_checks_passed: revision.seo_checks_passed,
      revision_notes: revision.revision_notes,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await updateQueueStatus(queueItem.id, "pending"); // return to queue
    await insertLog({
      queue_id: queueItem.id,
      post_id: null,
      status: "error",
      confidence_score: null,
      seo_checks_passed: null,
      revision_notes: null,
      error_message: errorMessage,
    }).catch(() => {}); // don't let log failure mask real error

    return { status: "error", queueItem, error: errorMessage };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt <= MAX_RETRIES) {
        // brief back-off before retry
        await sleep(1000 * attempt);
      }
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validatePayload(revision: RevisionResult, coverImageUrl: string): void {
  if (!revision.title || revision.title.trim() === "") {
    throw new Error("Supervisor: revised title is empty");
  }
  if (!revision.excerpt || revision.excerpt.trim() === "") {
    throw new Error("Supervisor: revised excerpt is empty");
  }
  if (!revision.content || revision.content.trim() === "") {
    throw new Error("Supervisor: revised content is empty");
  }
  if (!coverImageUrl || !coverImageUrl.startsWith("http")) {
    throw new Error("Supervisor: invalid cover image URL");
  }
}
