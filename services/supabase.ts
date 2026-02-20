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

export interface ScheduleSettings {
  active: boolean;
  run_times: string[]; // HH:MM strings in the configured timezone, e.g. ["06:00","12:00","18:00"]
  timezone: string;    // IANA timezone identifier, e.g. "UTC" or "America/New_York"
}

/** Read all schedule settings in one round-trip. Gracefully defaults on error. */
export async function getScheduleSettings(): Promise<ScheduleSettings> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["scheduler_active", "scheduler_run_times", "scheduler_timezone"]);

    const map = Object.fromEntries(
      (data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])
    );

    const active =
      map.scheduler_active == null
        ? true
        : map.scheduler_active === true || map.scheduler_active === "true";

    const run_times = Array.isArray(map.scheduler_run_times)
      ? (map.scheduler_run_times as string[])
      : ["06:00", "12:00", "18:00"];

    const timezone =
      typeof map.scheduler_timezone === "string"
        ? map.scheduler_timezone
        : "UTC";

    return { active, run_times, timezone };
  } catch {
    return { active: true, run_times: ["06:00", "12:00", "18:00"], timezone: "UTC" };
  }
}

/** Persist any subset of schedule settings. */
export async function setScheduleSettings(
  patch: Partial<ScheduleSettings>
): Promise<void> {
  const now = new Date().toISOString();
  const rows: { key: string; value: unknown; updated_at: string }[] = [];
  if (patch.active !== undefined)
    rows.push({ key: "scheduler_active", value: patch.active, updated_at: now });
  if (patch.run_times !== undefined)
    rows.push({ key: "scheduler_run_times", value: patch.run_times, updated_at: now });
  if (patch.timezone !== undefined)
    rows.push({ key: "scheduler_timezone", value: patch.timezone, updated_at: now });
  if (rows.length > 0)
    await supabase.from("app_settings").upsert(rows);
}

/** Convenience alias used by legacy callers (Nav status badge). */
export async function getSchedulerActive(): Promise<boolean> {
  const s = await getScheduleSettings();
  return s.active;
}

/** Convenience alias used by legacy callers. */
export async function setSchedulerActive(active: boolean): Promise<void> {
  await setScheduleSettings({ active });
}

/**
 * Reset any queue items that are stuck as "in_progress" (e.g. from a crashed
 * pipeline run). Called at the start of each pipeline execution.
 */
export async function resetInProgressItems(): Promise<void> {
  await supabase
    .from("automation_queue")
    .update({ status: "pending" })
    .eq("status", "in_progress");
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
