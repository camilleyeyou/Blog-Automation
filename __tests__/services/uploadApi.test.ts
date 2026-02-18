import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadImage } from "@/services/uploadApi";

describe("uploadImage", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.BLOG_API_URL = "https://jesse-eisenbalm-server.vercel.app";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uploads buffer and returns URL", async () => {
    const fakeUrl =
      "https://kqyiauyahlmruyblxezp.supabase.co/storage/v1/object/public/post-images/test.jpg";

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: fakeUrl }),
    } as Response);

    const buffer = Buffer.from("fake-image-data");
    const result = await uploadImage(buffer, "image/jpeg");

    expect(result.url).toBe(fakeUrl);

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe(
      "https://jesse-eisenbalm-server.vercel.app/api/admin/upload"
    );
    expect(callArgs[1].method).toBe("POST");
    expect(callArgs[1].headers["x-admin-password"]).toBe("test-admin-password");
  });

  it("throws when ADMIN_PASSWORD is not set", async () => {
    delete process.env.ADMIN_PASSWORD;

    const buffer = Buffer.from("fake-image-data");
    await expect(uploadImage(buffer)).rejects.toThrow(
      "ADMIN_PASSWORD environment variable is not set"
    );
  });

  it("throws on non-OK response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Invalid password",
    } as Response);

    const buffer = Buffer.from("fake-image-data");
    await expect(uploadImage(buffer)).rejects.toThrow("Upload failed: 403 Forbidden");
  });

  it("throws when response is missing url", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const buffer = Buffer.from("fake-image-data");
    await expect(uploadImage(buffer)).rejects.toThrow(
      "Upload response missing url field"
    );
  });
});
