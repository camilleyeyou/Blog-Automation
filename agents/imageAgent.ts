import { GoogleGenerativeAI } from "@google/generative-ai";
import { uploadImage } from "@/services/uploadApi";
import { IMAGE_AESTHETIC_SUFFIX } from "@/prompts/brandContext";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export interface ImageResult {
  url: string;
}

export async function runImageAgent(
  title: string,
  excerpt: string
): Promise<ImageResult> {
  const prompt = buildImagePrompt(title, excerpt);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-preview-image-generation",
  });

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      // @ts-expect-error — responseModalities not yet in type definitions
      responseModalities: ["IMAGE"],
    },
  });

  const parts = response.response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("Image agent: no candidates in Gemini response");

  const imagePart = parts.find(
    (p) => "inlineData" in p && p.inlineData?.mimeType?.startsWith("image/")
  );

  if (!imagePart || !("inlineData" in imagePart) || !imagePart.inlineData) {
    throw new Error("Image agent: no image part in Gemini response");
  }

  const { mimeType, data: base64Data } = imagePart.inlineData;
  const buffer = Buffer.from(base64Data, "base64");

  const validMime = (
    mimeType === "image/png" || mimeType === "image/webp"
      ? mimeType
      : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/webp";

  return uploadImage(buffer, validMime);
}

function buildImagePrompt(title: string, excerpt: string): string {
  return `Create a cover image for a blog post titled "${title}".

The post is about: ${excerpt}

${IMAGE_AESTHETIC_SUFFIX}`;
}
