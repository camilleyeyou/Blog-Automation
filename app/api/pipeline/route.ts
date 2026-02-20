import { NextRequest, NextResponse } from "next/server";
import { verifyDashboardAuth, verifyCronSecret } from "@/lib/auth";

export const maxDuration = 300; // 5 min — Railway pipeline can be slow

function railwayUrl(path: string): string {
  const base = process.env.RAILWAY_API_URL?.replace(/\/$/, "");
  if (!base) throw new Error("RAILWAY_API_URL is not set");
  return `${base}${path}`;
}

function railwayHeaders(): Record<string, string> {
  const key = process.env.RAILWAY_API_KEY;
  if (!key) throw new Error("RAILWAY_API_KEY is not set");
  return { "x-api-key": key, "Content-Type": "application/json" };
}

export async function POST(request: NextRequest) {
  const isCron = verifyCronSecret(request);
  const isDashboard = verifyDashboardAuth(request);

  if (!isCron && !isDashboard) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(railwayUrl("/pipeline"), {
      method: "POST",
      headers: railwayHeaders(),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
