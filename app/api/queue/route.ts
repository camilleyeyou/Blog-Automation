import { NextRequest, NextResponse } from "next/server";
import { getAllQueueItems, addQueueItem } from "@/services/supabase";
import { verifyDashboardAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!verifyDashboardAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await getAllQueueItems();
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyDashboardAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topic, focus_keyphrase, keywords } = body as Record<string, unknown>;

  if (typeof topic !== "string" || topic.trim() === "") {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  try {
    const item = await addQueueItem(
      topic.trim(),
      typeof focus_keyphrase === "string" ? focus_keyphrase.trim() : undefined,
      Array.isArray(keywords) ? keywords.map(String) : undefined
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
