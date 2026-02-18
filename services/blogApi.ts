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
