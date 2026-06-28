/** Shared upload rules - used by server processing and UI copy. */

export const MAX_INPUT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_INPUT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type ImagePreset = "event" | "venue";

export type ImagePresetRules = {
  label: string;
  minWidth: number;
  minHeight: number;
  maxLongEdge: number;
  minAspect: number;
  maxAspect: number;
  maxOutputBytes: number;
  startQuality: number;
  minQuality: number;
};

export const IMAGE_PRESETS: Record<ImagePreset, ImagePresetRules> = {
  event: {
    label: "Event photo",
    minWidth: 800,
    minHeight: 600,
    maxLongEdge: 1920,
    minAspect: 0.75, // 3:4 portrait
    maxAspect: 2.5, // wide banner
    maxOutputBytes: 600 * 1024,
    startQuality: 88,
    minQuality: 76,
  },
  venue: {
    label: "Venue cover",
    minWidth: 1200,
    minHeight: 675,
    maxLongEdge: 1600,
    minAspect: 1.2,
    maxAspect: 2.4,
    maxOutputBytes: 450 * 1024,
    startQuality: 86,
    minQuality: 74,
  },
};

export function presetForFolder(folder: "events" | "venues"): ImagePreset {
  return folder === "venues" ? "venue" : "event";
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Human-readable requirements shown next to upload controls. */
export function uploadRequirementsText(preset: ImagePreset): string {
  const r = IMAGE_PRESETS[preset];
  return [
    "JPG, PNG, WebP or GIF · max 10 MB upload",
    `Min ${r.minWidth}×${r.minHeight}px`,
    `Saved as high-quality WebP (≤${formatBytes(r.maxOutputBytes)})`,
    preset === "venue" ? "Landscape cover photo recommended" : "Star one image as the event cover",
  ].join(" · ");
}

export class ImageProcessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageProcessError";
  }
}
