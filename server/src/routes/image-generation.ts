import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolvePaperclipInstanceRoot } from "../home-paths.js";
import { assertCompanyAccess } from "./authz.js";
import { HttpError } from "../errors.js";
import { logger } from "../middleware/logger.js";

const GEMINI_IMAGE_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

export function imageGenerationRoutes() {
  const router = Router();

  router.post("/companies/:companyId/generate-image", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId);

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new HttpError(500, "GOOGLE_API_KEY is not configured");
    }

    const { prompt, style, aspectRatio } = req.body as {
      prompt: string;
      style?: string;
      aspectRatio?: "1:1" | "16:9" | "9:16";
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new HttpError(400, "prompt is required");
    }

    // Build enhanced prompt with style and aspect ratio hints
    const styleHints: Record<string, string> = {
      Lifestyle: "lifestyle photography style, natural environment, candid feel",
      Product: "product photography, clean professional shot, commercial grade",
      "Flat Lay": "flat lay photography, top-down overhead view, styled arrangement",
      Studio: "studio photography, controlled lighting, seamless background",
      Illustration: "digital illustration, artistic, vector-style graphic design",
    };
    const aspectHints: Record<string, string> = {
      "1:1": "square format 1:1 aspect ratio",
      "16:9": "wide landscape 16:9 aspect ratio",
      "9:16": "vertical portrait 9:16 aspect ratio for social media stories",
    };

    const styleNote = style && styleHints[style] ? `\nStyle: ${styleHints[style]}` : "";
    const aspectNote = aspectRatio && aspectHints[aspectRatio] ? `\nFormat: ${aspectHints[aspectRatio]}` : "";
    const fullPrompt = `${prompt.trim()}${styleNote}${aspectNote}`;

    logger.info(`[image-gen] Generating image for company=${req.params.companyId}, prompt="${prompt.trim().slice(0, 80)}..."`);

    let geminiRes: Response;
    try {
      geminiRes = await fetch(`${GEMINI_IMAGE_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });
    } catch (err) {
      logger.error({ err }, "[image-gen] Network error calling Gemini API");
      throw new HttpError(502, "Failed to reach image generation service");
    }

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({})) as Record<string, unknown>;
      const errMsg = (errBody as { error?: { message?: string } })?.error?.message ?? "Unknown error";
      logger.warn(`[image-gen] Gemini API error status=${geminiRes.status}: ${errMsg}`);

      if (geminiRes.status === 429) {
        throw new HttpError(429, "Image generation quota reached, try again in a moment");
      }
      if (
        geminiRes.status === 403 ||
        (typeof errMsg === "string" && errMsg.toLowerCase().includes("billing"))
      ) {
        throw new HttpError(402, "Enable billing at ai.dev/projects to use image generation");
      }
      throw new HttpError(geminiRes.status, `Image generation failed: ${errMsg}`);
    }

    const data = await geminiRes.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inlineData?: { data: string; mimeType: string };
          }>;
        };
      }>;
    };

    // Find the image part in the response
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (!imagePart?.inlineData) {
      logger.warn({ dataSnippet: JSON.stringify(data).slice(0, 300) }, "[image-gen] Gemini response contained no image data");
      throw new HttpError(500, "Image generation returned no image");
    }

    const { data: b64, mimeType } = imagePart.inlineData;
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const filename = `${randomUUID()}.${ext}`;

    // Save image to disk
    const imagesDir = path.join(resolvePaperclipInstanceRoot(), "data", "images");
    fs.mkdirSync(imagesDir, { recursive: true });
    const filePath = path.join(imagesDir, filename);
    fs.writeFileSync(filePath, Buffer.from(b64, "base64"));

    logger.info(`[image-gen] Saved image to ${filePath}`);

    res.json({
      imageUrl: `/api/generated-images/${filename}`,
      mimeType,
    });
  });

  // Serve generated images
  router.get("/generated-images/:filename", (req, res) => {
    const { filename } = req.params;
    // Basic safety: only allow uuid.ext filenames
    if (!/^[0-9a-f-]+\.(png|jpg|jpeg|webp)$/i.test(filename)) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const imagesDir = path.join(resolvePaperclipInstanceRoot(), "data", "images");
    const filePath = path.join(imagesDir, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    const ext = path.extname(filename).slice(1).toLowerCase();
    const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
    res.setHeader("Content-Type", mimeMap[ext] ?? "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath);
  });

  return router;
}
