"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PostDetail } from "@/services/blogApi";

function getAuthHeaders(): HeadersInit {
  const pw =
    typeof window !== "undefined"
      ? (localStorage.getItem("dashboard_password") ?? "")
      : "";
  return { "x-dashboard-password": pw };
}

const BLOG_URL = "https://jesseaeisenbalm.com";

export default function PostPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPost() {
      try {
        const res = await fetch(`/api/posts/${id}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = (await res.json()) as { post: PostDetail };
        setPost(data.post);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load post");
      } finally {
        setLoading(false);
      }
    }
    void fetchPost();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-stone">Loading post…</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/history" className="text-sm text-stone hover:text-ink">
          ← Back to History
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error ?? "Post not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-stone hover:text-ink transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${
              post.published
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-amber-50 text-amber-700 ring-amber-200"
            }`}
          >
            {post.published ? "Published" : "Draft"}
          </span>
          <a
            href={`${BLOG_URL}/blog/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-beige px-3 py-1.5 text-xs text-stone transition-colors hover:border-stone hover:text-ink"
          >
            View on site ↗
          </a>
        </div>
      </div>

      {/* Post preview card */}
      <article className="overflow-hidden rounded-2xl border border-beige bg-white shadow-card">
        {/* Cover image */}
        {post.cover_image && (
          <div className="aspect-video w-full overflow-hidden bg-beige">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover_image}
              alt={post.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="px-8 py-8 md:px-12 md:py-10">
          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-beige/60 px-2 py-0.5 text-xs text-stone"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl font-semibold leading-snug tracking-tight text-ink md:text-3xl">
            {post.title}
          </h1>

          {/* Excerpt */}
          <p className="mt-3 text-base leading-relaxed text-charcoal/70 italic border-l-2 border-beige pl-4">
            {post.excerpt}
          </p>

          {/* Meta */}
          <div className="mt-4 flex items-center gap-4 text-xs text-stone">
            <span>{post.author}</span>
            <span>·</span>
            <span>{new Date(post.created_at).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric"
            })}</span>
          </div>

          {/* Divider */}
          <hr className="my-8 border-beige" />

          {/* Body content */}
          <div
            className="post-body"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </div>
      </article>

      {/* Raw metadata for SEO review */}
      <div className="rounded-xl border border-beige bg-white p-5 shadow-card">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-stone">
          SEO Metadata
        </h2>
        <dl className="space-y-3 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-stone">Title</dt>
            <dd className="text-charcoal">
              {post.title}
              <span className="ml-2 text-xs text-stone/60">
                ({post.title.length} chars)
              </span>
            </dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-stone">Excerpt</dt>
            <dd className="text-charcoal">
              {post.excerpt}
              <span className="ml-2 text-xs text-stone/60">
                ({post.excerpt.length} chars)
              </span>
            </dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-stone">Slug</dt>
            <dd className="font-mono text-xs text-charcoal">/blog/{post.slug}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-stone">Post ID</dt>
            <dd className="font-mono text-xs text-stone/60">{post.id}</dd>
          </div>
        </dl>
      </div>

      <style>{`
        .post-body { color: #2A2A2A; line-height: 1.75; }
        .post-body h2 { font-size: 1.25rem; font-weight: 600; margin: 2rem 0 0.75rem; color: #1A1A1A; letter-spacing: -0.01em; }
        .post-body h3 { font-size: 1.05rem; font-weight: 600; margin: 1.5rem 0 0.5rem; color: #1A1A1A; }
        .post-body p { margin: 0 0 1.25rem; font-size: 0.9375rem; }
        .post-body ul, .post-body ol { margin: 0 0 1.25rem 1.5rem; font-size: 0.9375rem; }
        .post-body li { margin-bottom: 0.375rem; }
        .post-body a { color: #1A1A1A; text-decoration: underline; text-underline-offset: 3px; }
        .post-body a:hover { opacity: 0.7; }
        .post-body strong { font-weight: 600; color: #1A1A1A; }
        .post-body blockquote { border-left: 2px solid #E8DDD0; padding-left: 1rem; color: #C4B5A5; margin: 1.5rem 0; font-style: italic; }
        .post-body img { max-width: 100%; border-radius: 0.5rem; margin: 1.5rem 0; }
      `}</style>
    </div>
  );
}
