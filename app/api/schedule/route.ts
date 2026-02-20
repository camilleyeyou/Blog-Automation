import { NextRequest, NextResponse } from "next/server";
import { verifyDashboardAuth } from "@/lib/auth";
import {
  getScheduleSettings,
  setScheduleSettings,
  type ScheduleSettings,
} from "@/services/supabase";

async function notifyRailwayReloadSchedule(): Promise<void> {
  const base = process.env.RAILWAY_API_URL?.replace(/\/$/, "");
  const key = process.env.RAILWAY_API_KEY;
  if (!base || !key) return; // not configured — skip silently
  try {
    await fetch(`${base}/reload-schedule`, {
      method: "POST",
      headers: { "x-api-key": key },
    });
  } catch {
    // non-fatal — Supabase is already updated; Railway will pick it up on next restart
  }
}

export async function GET(request: NextRequest) {
  if (!verifyDashboardAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getScheduleSettings();
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  if (!verifyDashboardAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<ScheduleSettings>;
  try {
    body = (await request.json()) as Partial<ScheduleSettings>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate active
  if (body.active !== undefined && typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  }

  // Validate run_times
  if (body.run_times !== undefined) {
    if (!Array.isArray(body.run_times) || body.run_times.length < 1 || body.run_times.length > 5) {
      return NextResponse.json(
        { error: "run_times must be an array of 1–5 time strings" },
        { status: 400 }
      );
    }
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const t of body.run_times) {
      if (!validTime.test(t)) {
        return NextResponse.json(
          { error: `Invalid time format: "${t}". Use HH:MM (24-hour)` },
          { status: 400 }
        );
      }
    }
  }

  // Validate timezone
  if (body.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
    } catch {
      return NextResponse.json(
        { error: `Invalid timezone: "${body.timezone}"` },
        { status: 400 }
      );
    }
  }

  await setScheduleSettings(body);
  // Tell Railway to reload its APScheduler jobs immediately (fire-and-forget)
  void notifyRailwayReloadSchedule();
  const updated = await getScheduleSettings();
  return NextResponse.json(updated);
}
