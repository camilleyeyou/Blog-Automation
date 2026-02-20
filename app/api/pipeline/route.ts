import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/agents/supervisorAgent";
import { verifyDashboardAuth, verifyCronSecret } from "@/lib/auth";
import { getScheduleSettings, resetInProgressItems } from "@/services/supabase";

export const maxDuration = 300; // 5 min — image gen + LLM calls can be slow

/**
 * Determine whether the cron should execute right now.
 * Matches the current hour (in the configured timezone) against the stored run times.
 * The Vercel cron fires every hour; this gate decides whether to actually run.
 */
function shouldRunNow(runTimes: string[], timezone: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    const currentHour = parseInt(hourStr, 10) % 24;
    return runTimes.some((t) => parseInt(t.split(":")[0], 10) === currentHour);
  } catch {
    // Invalid timezone — fall back to UTC hour comparison
    const utcHour = new Date().getUTCHours();
    return runTimes.some((t) => parseInt(t.split(":")[0], 10) === utcHour);
  }
}

export async function POST(request: NextRequest) {
  const isCron = verifyCronSecret(request);
  const isDashboard = verifyDashboardAuth(request);

  if (!isCron && !isDashboard) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cron triggers respect scheduler settings; dashboard "Run Now" always runs
  if (isCron && !isDashboard) {
    const settings = await getScheduleSettings();

    if (!settings.active) {
      return NextResponse.json({ status: "paused", message: "Scheduler is paused" });
    }

    if (!shouldRunNow(settings.run_times, settings.timezone)) {
      return NextResponse.json({
        status: "skipped",
        message: `Not a scheduled run time — configured: ${settings.run_times.join(", ")} ${settings.timezone}`,
      });
    }
  }

  // Reset any items stuck as "in_progress" from a previous crashed run
  await resetInProgressItems().catch(() => {}); // non-fatal

  try {
    const result = await runPipeline();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
