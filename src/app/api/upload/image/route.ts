import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import { processImageForUpload } from "@/lib/image-process";
import {
  ALLOWED_INPUT_TYPES,
  MAX_INPUT_BYTES,
  presetForFolder,
  ImageProcessError,
} from "@/lib/image-rules";
import { IMAGE_BUCKET } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const folderSchema = z.enum(["events", "venues"]);

export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in to upload images." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const folderParsed = folderSchema.safeParse(form.get("folder"));
  if (!folderParsed.success) {
    return NextResponse.json({ error: "Invalid upload destination." }, { status: 400 });
  }
  const folder = folderParsed.data;

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose an image file to upload." }, { status: 400 });
  }

  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, WebP, or GIF image." },
      { status: 422 }
    );
  }

  if (file.size > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: "Original file must be 10 MB or smaller." },
      { status: 422 }
    );
  }

  const preset = presetForFolder(folder);
  const input = Buffer.from(await file.arrayBuffer());

  let processed;
  try {
    processed = await processImageForUpload(input, preset);
  } catch (err) {
    const message =
      err instanceof ImageProcessError
        ? err.message
        : "Could not process this image. Try JPG or PNG.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const path = `uploads/${userId}/${folder}/${Date.now()}-${randomUUID().slice(0, 8)}.${processed.extension}`;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, processed.buffer, {
    contentType: processed.contentType,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    console.error("Storage upload failed", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);

  return NextResponse.json({
    url: data.publicUrl,
    meta: {
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
      quality: processed.quality,
      format: processed.extension,
    },
  });
}
