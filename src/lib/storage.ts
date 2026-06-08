import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ALLOWED_INPUT_TYPES,
  MAX_INPUT_BYTES,
} from "@/lib/image-rules";

export const IMAGE_BUCKET = "event-images";

export type ImageFolder = "events" | "venues";

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    return "Use a JPG, PNG, WebP, or GIF image.";
  }
  if (file.size > MAX_INPUT_BYTES) {
    return "Original file must be 10 MB or smaller.";
  }
  return null;
}

export function isStorageImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname.includes(`/storage/v1/object/public/${IMAGE_BUCKET}/`);
  } catch {
    return false;
  }
}

export function storagePathFromUrl(url: string): string | null {
  if (!isStorageImageUrl(url)) return null;
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

export type UploadImageResult = {
  url: string;
  meta?: { width: number; height: number; bytes: number; quality: number; format: string };
};

/**
 * Sends the file to the server for validation, compression (WebP), and storage.
 * Rejects with a clear message when the image does not meet platform rules.
 */
export async function uploadImageFromBrowser(
  file: File,
  folder: ImageFolder
): Promise<UploadImageResult> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);

  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in to upload images.");

  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);

  const res = await fetch("/api/upload/image", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; meta?: UploadImageResult["meta"] };

  if (!res.ok) {
    throw new Error(data.error ?? "Upload failed. Please try again.");
  }
  if (!data.url) throw new Error("Upload failed. Please try again.");

  return { url: data.url, meta: data.meta };
}

/** Remove a previously uploaded file (no-op for external URLs). */
export async function deleteStorageImageFromBrowser(url: string): Promise<void> {
  const path = storagePathFromUrl(url);
  if (!path) return;

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}
