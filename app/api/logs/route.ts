import { NextRequest, NextResponse } from "next/server";
import { getLogs } from "@/services/supabase";
import { verifyDashboardAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!verifyDashboardAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

  try {
    const logs = await getLogs(limit);
    return NextResponse.json({ logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
