"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  deleteStorageImageFromBrowser,
  uploadImageFromBrowser,
  type ImageFolder,
} from "@/lib/storage";
import { presetForFolder, uploadRequirementsText } from "@/lib/image-rules";

type ImageGalleryEditorProps = {
  images: string[];
  primaryIndex: number;
  onChange: (images: string[], primaryIndex: number) => void;
  folder: ImageFolder;
  maxImages?: number;
  className?: string;
};

export function ImageGalleryEditor({
  images,
  primaryIndex,
  onChange,
  folder,
  maxImages = 12,
  className,
}: ImageGalleryEditorProps) {
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const pickFiles = () => inputRef.current?.click();

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      toast({ title: "Gallery full", description: `Maximum ${maxImages} images.` });
      return;
    }

    setUploading(true);
    const next = [...images];
    let primary = primaryIndex;
    const failures: string[] = [];

    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        try {
          const { url } = await uploadImageFromBrowser(file, folder);
          next.push(url);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Could not upload.";
          failures.push(`${file.name}: ${msg}`);
        }
      }
      if (next.length && primary >= next.length) primary = 0;
      onChange(next, primary);

      if (failures.length) {
        toast({
          title: failures.length === 1 ? "Image rejected" : `${failures.length} images rejected`,
          description: failures.join("\n"),
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = async (index: number) => {
    const url = images[index];
    try {
      await deleteStorageImageFromBrowser(url);
    } catch {
      /* keep going — DB record may still be removed */
    }
    const next = images.filter((_, i) => i !== index);
    let primary = primaryIndex;
    if (index === primary) primary = 0;
    else if (index < primary) primary = Math.max(0, primary - 1);
    if (primary >= next.length) primary = Math.max(0, next.length - 1);
    onChange(next, primary);
  };

  const requirements = uploadRequirementsText(presetForFolder(folder));

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{requirements}</p>
        <Button type="button" variant="outline" size="sm" onClick={pickFiles} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Processing…" : "Upload images"}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => void uploadFiles(e.target.files)}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className={cn(
              "group relative aspect-[4/3] overflow-hidden rounded-xl border-2",
              i === primaryIndex ? "border-primary ring-2 ring-primary/40" : "border-transparent"
            )}
          >
            <Image src={src} alt="" fill sizes="240px" className="object-cover" unoptimized={src.includes("/storage/")} />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2">
              <button
                type="button"
                onClick={() => onChange(images, i)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium",
                  i === primaryIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/80 text-foreground"
                )}
              >
                <Star className={cn("h-3 w-3", i === primaryIndex && "fill-current")} />
                {i === primaryIndex ? "Cover" : "Set cover"}
              </button>
              <button
                type="button"
                onClick={() => void removeAt(i)}
                className="rounded-full bg-background/80 p-1.5 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}

        {images.length < maxImages && (
          <button
            type="button"
            onClick={pickFiles}
            disabled={uploading}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <span className="text-xs font-medium">Add image</span>
          </button>
        )}
      </div>

      {images.length === 0 && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">Add at least one image before publishing.</p>
      )}
    </div>
  );
}

type CoverImageUploadProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: ImageFolder;
  fallback?: string;
  className?: string;
};

export function CoverImageUpload({
  value,
  onChange,
  folder,
  fallback,
  className,
}: CoverImageUploadProps) {
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const preview = value || fallback || "";

  const requirements = uploadRequirementsText(presetForFolder(folder));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      if (value) await deleteStorageImageFromBrowser(value).catch(() => undefined);
      const { url } = await uploadImageFromBrowser(file, folder);
      onChange(url);
    } catch (err) {
      toast({
        title: "Image rejected",
        description: err instanceof Error ? err.message : "Could not upload image.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (value) {
      try {
        await deleteStorageImageFromBrowser(value);
      } catch {
        /* ignore */
      }
    }
    onChange(null);
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />

      {preview ? (
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border">
          <Image src={preview} alt="" fill className="object-cover" unoptimized={preview.includes("/storage/")} />
          <div className="absolute right-2 top-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Change
            </Button>
            {value && (
              <Button type="button" size="sm" variant="destructive" onClick={() => void remove()} disabled={uploading}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <ImagePlus className="h-8 w-8" />}
          <span className="text-sm font-medium">Upload cover photo</span>
          <span className="max-w-xs text-center text-xs">{requirements}</span>
        </button>
      )}
    </div>
  );
}
