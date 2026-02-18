export interface UploadResult {
  url: string;
}

/**
 * Upload an image buffer to Supabase Storage via the blog server's upload endpoint.
 * Returns the public CDN URL of the uploaded file.
 */
export async function uploadImage(
  imageBuffer: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<UploadResult> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const apiUrl = process.env.BLOG_API_URL ?? "https://jesse-eisenbalm-server.vercel.app";

  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD environment variable is not set");
  }

  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  formData.append("file", blob, filename);

  const response = await fetch(`${apiUrl}/api/admin/upload`, {
    method: "POST",
    headers: {
      "x-admin-password": adminPassword,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Upload failed: ${response.status} ${response.statusText} — ${text}`
    );
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error("Upload response missing url field");
  }

  return { url: data.url };
}
