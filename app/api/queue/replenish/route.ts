import { NextRequest, NextResponse } from "next/server";
import { verifyDashboardAuth, verifyCronSecret } from "@/lib/auth";
import { getAllQueueItems, addQueueItem } from "@/services/supabase";
import { runTopicAgent } from "@/agents/topicAgent";

export const maxDuration = 120;

/** Replenish the queue when it drops below this many pending items */
const REPLENISH_THRESHOLD = 6;
/** How many new topics to generate when replenishing */
const REPLENISH_COUNT = 15;

/**
 * POST /api/queue/replenish
 * Called automatically from the pipeline (when queue is low) or manually via dashboard.
 * Generates SEO-optimised topics using the topic agent and inserts them into automation_queue.
 */
export async function POST(request: NextRequest) {
  const isCron = verifyCronSecret(request);
  const isDashboard = verifyDashboardAuth(request);

  if (!isCron && !isDashboard) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allItems = await getAllQueueItems();
    const pendingCount = allItems.filter((item) => item.status === "pending").length;

    if (pendingCount >= REPLENISH_THRESHOLD) {
      return NextResponse.json({
        message: `Queue has ${pendingCount} pending items — no replenishment needed`,
        added: 0,
        topics: [],
      });
    }

    const existingTopics = allItems.map((item) => item.topic);
    const suggestions = await runTopicAgent(REPLENISH_COUNT, existingTopics);

    const added: string[] = [];
    for (const s of suggestions) {
      await addQueueItem(s.topic, s.focus_keyphrase, s.keywords);
      added.push(s.topic);
    }

    return NextResponse.json({
      message: `Replenished queue with ${added.length} new topics`,
      added: added.length,
      topics: added,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
