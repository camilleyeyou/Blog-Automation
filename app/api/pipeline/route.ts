import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/agents/supervisorAgent";
import { verifyDashboardAuth, verifyCronSecret } from "@/lib/auth";
import { getSchedulerActive, resetInProgressItems } from "@/services/supabase";

export const maxDuration = 300; // 5 min — image gen + LLM calls can be slow

export async function POST(request: NextRequest) {
  const isCron = verifyCronSecret(request);
  const isDashboard = verifyDashboardAuth(request);

  if (!isCron && !isDashboard) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cron triggers respect the scheduler active toggle; dashboard triggers always run
  if (isCron && !isDashboard) {
    const active = await getSchedulerActive();
    if (!active) {
      return NextResponse.json({ status: "paused", message: "Scheduler is paused" });
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
