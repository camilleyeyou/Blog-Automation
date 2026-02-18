import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/services/supabase";
import { createPost } from "@/services/blogApi";
import { verifyDashboardAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyDashboardAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, title, excerpt, content, tags, cover_image } =
    body as Record<string, unknown>;

  if (action !== "approve" && action !== "discard") {
    return NextResponse.json(
      { error: 'action must be "approve" or "discard"' },
      { status: 400 }
    );
  }

  if (action === "discard") {
    await supabase
      .from("automation_queue")
      .update({ status: "discarded" })
      .eq("id", id);
    return NextResponse.json({ status: "discarded" });
  }

  // action === "approve" — publish the held post
  if (
    typeof title !== "string" ||
    typeof excerpt !== "string" ||
    typeof content !== "string" ||
    typeof cover_image !== "string"
  ) {
    return NextResponse.json(
      { error: "title, excerpt, content, and cover_image are required for approval" },
      { status: 400 }
    );
  }

  try {
    const postResponse = await createPost({
      title,
      excerpt,
      content,
      author: "Jesse A. Eisenbalm",
      cover_image,
      tags: Array.isArray(tags) ? tags.map(String) : [],
      published: true,
    });

    await supabase
      .from("automation_queue")
      .update({ status: "published", processed_at: new Date().toISOString() })
      .eq("id", id);

    await supabase.from("automation_logs").insert({
      queue_id: id,
      post_id: postResponse.post.id,
      status: "success",
      revision_notes: "Manually approved from review queue",
    });

    return NextResponse.json({ status: "published", post: postResponse.post });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
