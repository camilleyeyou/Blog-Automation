import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/agents/supervisorAgent";
import { verifyDashboardAuth, verifyCronSecret } from "@/lib/auth";

export const maxDuration = 300; // 5 min — image gen + LLM calls can be slow

export async function POST(request: NextRequest) {
  // Accept either a cron trigger or a dashboard manual trigger
  const isCron = verifyCronSecret(request);
  const isDashboard = verifyDashboardAuth(request);

  if (!isCron && !isDashboard) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPipeline();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
