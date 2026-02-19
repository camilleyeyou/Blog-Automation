import { NextRequest, NextResponse } from "next/server";
import { verifyDashboardAuth } from "@/lib/auth";
import { getSchedulerActive, setSchedulerActive } from "@/services/supabase";

/** Scheduled run times (matches vercel.json cron entries) */
const SCHEDULE_TIMES = ["06:00", "12:00", "18:00"];
const TIMEZONE = "UTC";

export async function GET(request: NextRequest) {
  if (!verifyDashboardAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getSchedulerActive();
  return NextResponse.json({ active, times: SCHEDULE_TIMES, timezone: TIMEZONE });
}

export async function POST(request: NextRequest) {
  if (!verifyDashboardAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { active?: boolean };
  try {
    body = (await request.json()) as { active?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  }

  await setSchedulerActive(body.active);
  return NextResponse.json({ active: body.active, times: SCHEDULE_TIMES, timezone: TIMEZONE });
}
