export interface PostPayload {
  title: string;
  excerpt: string;
  content: string;
  author: string;
  cover_image: string;
  tags: string[];
  published: boolean;
}

export interface PostResponse {
  post: {
    id: string;
    slug: string;
    title: string;
    created_at: string;
  };
}

export interface PostDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  author: string;
  tags: string[];
  published: boolean;
  created_at: string;
}

/**
 * Fetch a single post by ID.
 * Tries GET /api/posts/:id first; if the server doesn't support that route
 * it falls back to fetching the full list and finding by ID.
 */
export async function getPost(id: string): Promise<PostDetail> {
  const apiKey = process.env.BLOG_API_KEY;
  const apiUrl = process.env.BLOG_API_URL ?? "https://jesse-eisenbalm-server.vercel.app";

  if (!apiKey) throw new Error("BLOG_API_KEY environment variable is not set");

  const headers = { "x-api-key": apiKey };

  // Try individual endpoint
  const single = await fetch(`${apiUrl}/api/posts/${id}`, {
    headers,
    cache: "no-store",
  });

  if (single.ok) {
    const data = (await single.json()) as { post: PostDetail };
    return data.post;
  }

  // Fallback: fetch all posts and find by ID
  const list = await fetch(`${apiUrl}/api/posts`, {
    headers,
    cache: "no-store",
  });

  if (!list.ok) {
    const text = await list.text().catch(() => "");
    throw new Error(`Blog API error: ${list.status} ${list.statusText} — ${text}`);
  }

  const listData = (await list.json()) as { posts: PostDetail[] };
  const post = listData.posts.find((p) => p.id === id);
  if (!post) throw new Error(`Post ${id} not found`);
  return post;
}

/**
 * Create a post on the Jesse A. Eisenbalm blog API.
 * Set published: true to go live, false to save as draft.
 */
export async function createPost(payload: PostPayload): Promise<PostResponse> {
  const apiKey = process.env.BLOG_API_KEY;
  const apiUrl = process.env.BLOG_API_URL ?? "https://jesse-eisenbalm-server.vercel.app";

  if (!apiKey) {
    throw new Error("BLOG_API_KEY environment variable is not set");
  }

  const response = await fetch(`${apiUrl}/api/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Blog API error: ${response.status} ${response.statusText} — ${text}`
    );
  }

  const data = (await response.json()) as PostResponse;
  if (!data.post?.id) {
    throw new Error("Blog API response missing post.id");
  }

  return data;
}
