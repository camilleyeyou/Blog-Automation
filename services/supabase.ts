import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  );
}

// Server-side only — never import this in client components
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueueStatus =
  | "pending"
  | "in_progress"
  | "published"
  | "held"
  | "discarded";

export type LogStatus = "success" | "draft" | "held" | "error";

export interface QueueItem {
  id: string;
  topic: string;
  focus_keyphrase: string | null;
  keywords: string[] | null;
  status: QueueStatus;
  created_at: string;
  processed_at: string | null;
}

export interface AutomationLog {
  id: string;
  queue_id: string | null;
  post_id: string | null;
  status: LogStatus;
  confidence_score: number | null;
  seo_checks_passed: number | null;
  revision_notes: string | null;
  error_message: string | null;
  created_at: string;
}

// ─── Queue helpers ────────────────────────────────────────────────────────────

export async function dequeueNextTopic(): Promise<QueueItem | null> {
  const { data, error } = await supabase
    .from("automation_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  // Mark as in_progress
  await supabase
    .from("automation_queue")
    .update({ status: "in_progress" })
    .eq("id", data.id);

  return data as QueueItem;
}

export async function updateQueueStatus(
  id: string,
  status: QueueStatus,
  processedAt?: boolean
): Promise<void> {
  await supabase
    .from("automation_queue")
    .update({
      status,
      ...(processedAt ? { processed_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);
}

export async function getAllQueueItems(): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from("automation_queue")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch queue: ${error.message}`);
  return (data ?? []) as QueueItem[];
}

export async function countPendingQueueItems(): Promise<number> {
  const { count, error } = await supabase
    .from("automation_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(`Failed to count pending items: ${error.message}`);
  return count ?? 0;
}

export async function addQueueItem(
  topic: string,
  focusKeyphrase?: string,
  keywords?: string[]
): Promise<QueueItem> {
  const { data, error } = await supabase
    .from("automation_queue")
    .insert({
      topic,
      focus_keyphrase: focusKeyphrase ?? null,
      keywords: keywords ?? null,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to add queue item: ${error?.message}`);
  return data as QueueItem;
}

// ─── Log helpers ──────────────────────────────────────────────────────────────

export async function insertLog(
  entry: Omit<AutomationLog, "id" | "created_at">
): Promise<AutomationLog> {
  const { data, error } = await supabase
    .from("automation_logs")
    .insert(entry)
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to insert log: ${error?.message}`);
  return data as AutomationLog;
}

export async function getLogs(limit = 50): Promise<AutomationLog[]> {
  const { data, error } = await supabase
    .from("automation_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch logs: ${error.message}`);
  return (data ?? []) as AutomationLog[];
}

// ─── Schedule settings ────────────────────────────────────────────────────────
// Requires this one-time SQL migration in Supabase:
//   CREATE TABLE IF NOT EXISTS app_settings (
//     key TEXT PRIMARY KEY,
//     value JSONB NOT NULL,
//     updated_at TIMESTAMPTZ DEFAULT now()
//   );
//   INSERT INTO app_settings (key, value) VALUES ('scheduler_active', 'true')
//   ON CONFLICT (key) DO NOTHING;

export async function getSchedulerActive(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "scheduler_active")
      .single();
    if (error || !data) return true;
    return data.value === true || data.value === "true";
  } catch {
    return true; // default active if table doesn't exist yet
  }
}

export async function setSchedulerActive(active: boolean): Promise<void> {
  await supabase.from("app_settings").upsert({
    key: "scheduler_active",
    value: active,
    updated_at: new Date().toISOString(),
  });
}

export async function getHeldItems(): Promise<
  { queue: QueueItem; log: AutomationLog }[]
> {
  const { data: queueItems, error } = await supabase
    .from("automation_queue")
    .select("*, automation_logs(*)")
    .eq("status", "held")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch held items: ${error.message}`);

  return (queueItems ?? []).map((item: Record<string, unknown>) => ({
    queue: item as unknown as QueueItem,
    log: (item.automation_logs as AutomationLog[])?.[0] ?? null,
  }));
}
