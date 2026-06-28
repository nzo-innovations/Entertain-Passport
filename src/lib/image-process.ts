import sharp from "sharp";
import {
  formatBytes,
  IMAGE_PRESETS,
  ImageProcessError,
  type ImagePreset,
} from "./image-rules";

export type ProcessedImage = {
  buffer: Buffer;
  contentType: "image/webp";
  extension: "webp";
  width: number;
  height: number;
  bytes: number;
  quality: number;
};

/**
 * Validates, resizes and compresses an image to WebP for Supabase storage.
 * Throws {@link ImageProcessError} with a user-facing message when rejected.
 */
export async function processImageForUpload(
  input: Buffer,
  preset: ImagePreset
): Promise<ProcessedImage> {
  const rules = IMAGE_PRESETS[preset];

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { animated: false }).metadata();
  } catch {
    throw new ImageProcessError(
      "This file could not be read as an image. Try exporting it again as JPG or PNG."
    );
  }

  if (!meta.width || !meta.height) {
    throw new ImageProcessError("Could not read image dimensions. Try a different file.");
  }

  if (meta.format === "gif" && meta.pages && meta.pages > 1) {
    throw new ImageProcessError(
      "Animated GIFs are not supported. Save a still frame as JPG or PNG and upload again."
    );
  }

  const { width, height } = meta;

  if (width < rules.minWidth || height < rules.minHeight) {
    throw new ImageProcessError(
      `${rules.label} is too small. Minimum ${rules.minWidth}×${rules.minHeight}px - yours is ${width}×${height}px. Use a higher-resolution photo.`
    );
  }

  const aspect = width / height;
  if (aspect < rules.minAspect || aspect > rules.maxAspect) {
    throw new ImageProcessError(
      `${rules.label} aspect ratio is not supported (${width}×${height}). ${
        preset === "venue"
          ? "Use a landscape cover between roughly 6:5 and 12:5 wide."
          : "Use a photo between portrait (3:4) and wide banner (5:2)."
      }`
    );
  }

  let pipeline = sharp(input, { animated: false }).rotate();

  const longest = Math.max(width, height);
  if (longest > rules.maxLongEdge) {
    pipeline = pipeline.resize(rules.maxLongEdge, rules.maxLongEdge, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let quality = rules.startQuality;
  let output: Buffer | undefined;

  while (quality >= rules.minQuality) {
    output = await pipeline.clone().webp({ quality, effort: 4 }).toBuffer();
    if (output.length <= rules.maxOutputBytes) break;
    quality -= 4;
  }

  if (!output || output.length > rules.maxOutputBytes) {
    throw new ImageProcessError(
      `Could not optimize this photo under ${formatBytes(rules.maxOutputBytes)} while keeping quality. Try a simpler image, crop tighter, or reduce detail before uploading.`
    );
  }

  const outMeta = await sharp(output).metadata();
  if (!outMeta.width || !outMeta.height) {
    throw new ImageProcessError("Image processing failed. Please try another file.");
  }

  return {
    buffer: output,
    contentType: "image/webp",
    extension: "webp",
    width: outMeta.width,
    height: outMeta.height,
    bytes: output.length,
    quality,
  };
}
