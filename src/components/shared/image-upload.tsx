"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ImagePlus, Loader2, RotateCcw, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  deleteStorageImageFromBrowser,
  uploadImageFromBrowser,
  type ImageFolder,
} from "@/lib/storage";
import {
  formatBytes,
  IMAGE_PRESETS,
  presetForFolder,
  uploadRequirementsText,
  type ImagePreset,
} from "@/lib/image-rules";

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
  const adjuster = useImageAdjustmentDialog();

  const pickFiles = () => inputRef.current?.click();
  const preset = presetForFolder(folder);

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
          const adjusted = await adjuster.prepare(file, preset);
          if (!adjusted) continue;
          const { url } = await uploadImageFromBrowser(adjusted, folder);
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
      /* keep going - DB record may still be removed */
    }
    const next = images.filter((_, i) => i !== index);
    let primary = primaryIndex;
    if (index === primary) primary = 0;
    else if (index < primary) primary = Math.max(0, primary - 1);
    if (primary >= next.length) primary = Math.max(0, next.length - 1);
    onChange(next, primary);
  };

  const requirements = uploadRequirementsText(preset);

  return (
    <div className={className}>
      {adjuster.node}
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
  const adjuster = useImageAdjustmentDialog();

  const preset = presetForFolder(folder);
  const requirements = uploadRequirementsText(preset);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const adjusted = await adjuster.prepare(file, preset);
      if (!adjusted) return;
      if (value) await deleteStorageImageFromBrowser(value).catch(() => undefined);
      const { url } = await uploadImageFromBrowser(adjusted, folder);
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
      {adjuster.node}
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

type ImageMeta = {
  width: number;
  height: number;
  url: string;
};

type AdjustmentPlan = {
  needed: boolean;
  reasons: string[];
  targetWidth: number;
  targetHeight: number;
  scaleLabel: string;
  previewLabel: string;
};

type AdjustmentRequest = {
  file: File;
  preset: ImagePreset;
  meta: ImageMeta;
  plan: AdjustmentPlan;
  resolve: (file: File | null) => void;
};

type AdjustmentPosition = {
  x: number;
  y: number;
};

const POSITION_STEP = 0.18;
const ZOOM_STEP = 0.1;

function useImageAdjustmentDialog() {
  const [request, setRequest] = React.useState<AdjustmentRequest | null>(null);
  const [step, setStep] = React.useState<"summary" | "position">("summary");
  const [position, setPosition] = React.useState<AdjustmentPosition>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);

  const prepare = React.useCallback(async (file: File, preset: ImagePreset): Promise<File | null> => {
    const meta = await readImageMeta(file);
    const plan = createAdjustmentPlan(meta, preset);

    if (!plan.needed) {
      URL.revokeObjectURL(meta.url);
      return file;
    }

    return new Promise<File | null>((resolve) => {
      setStep("summary");
      setPosition({ x: 0, y: 0 });
      setZoom(1);
      setRequest({ file, preset, meta, plan, resolve });
    });
  }, []);

  const close = React.useCallback(
    (result: File | null) => {
      if (request) {
        URL.revokeObjectURL(request.meta.url);
        request.resolve(result);
      }
      setStep("summary");
      setPosition({ x: 0, y: 0 });
      setZoom(1);
      setRequest(null);
    },
    [request]
  );

  const previewAdjustment = React.useCallback(() => {
    setStep("position");
  }, []);

  const movePosition = React.useCallback((dx: number, dy: number) => {
    setPosition((current) => ({
      x: clamp(current.x + dx, -1, 1),
      y: clamp(current.y + dy, -1, 1),
    }));
  }, []);

  const changeZoom = React.useCallback((delta: number) => {
    setZoom((current) => clamp(Number((current + delta).toFixed(2)), 1, 2));
  }, []);

  const resetAdjustment = React.useCallback(() => {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const adjustAndUpload = React.useCallback(async () => {
    if (!request) return;
    const adjusted = await buildAdjustedImageFile(request.file, request.meta, request.plan, position, zoom);
    close(adjusted);
  }, [close, position, request, zoom]);

  const node = (
    <Dialog open={!!request} onOpenChange={(open) => !open && close(null)}>
      {request && (
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Adjust image before upload</DialogTitle>
            <DialogDescription>
              This image needs adjustment to match platform upload rules. Preview and position it before uploading.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
            {step === "summary" ? (
              <div className="overflow-hidden rounded-xl border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={request.meta.url}
                  alt=""
                  className="max-h-[420px] w-full object-contain"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <AdjustedImagePreview request={request} position={position} zoom={zoom} />
                <p className="text-center text-xs text-muted-foreground">
                  Exact {request.plan.previewLabel} preview at {request.plan.targetWidth}×{request.plan.targetHeight}px.
                  Use zoom and arrows to choose what appears after upload.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4 text-sm">
                <p className="font-semibold">{request.file.name}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <dt className="text-muted-foreground">Original</dt>
                  <dd className="text-right font-mono">
                    {request.meta.width}×{request.meta.height}px
                  </dd>
                  <dt className="text-muted-foreground">Final preview</dt>
                  <dd className="text-right font-mono">
                    {request.plan.targetWidth}×{request.plan.targetHeight}px
                  </dd>
                  <dt className="text-muted-foreground">Mode</dt>
                  <dd className="text-right">{request.plan.scaleLabel}</dd>
                </dl>
              </div>

              {step === "summary" ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-300">Why adjust?</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                    {request.plan.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border bg-card p-4 text-sm">
                  <p className="font-medium">Move image position</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom <= 1}>
                      Zoom out
                    </Button>
                    <div className="flex-1 rounded-md border px-3 py-2 text-center text-xs font-medium">
                      {Math.round(zoom * 100)}%
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom >= 2}>
                      Zoom in
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <span />
                    <Button type="button" variant="outline" size="sm" onClick={() => movePosition(0, -POSITION_STEP)}>
                      <ArrowUp className="h-4 w-4" />
                      Up
                    </Button>
                    <span />
                    <Button type="button" variant="outline" size="sm" onClick={() => movePosition(-POSITION_STEP, 0)}>
                      <ArrowLeft className="h-4 w-4" />
                      Left
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={resetAdjustment}>
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => movePosition(POSITION_STEP, 0)}>
                      Right
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <span />
                    <Button type="button" variant="outline" size="sm" onClick={() => movePosition(0, POSITION_STEP)}>
                      <ArrowDown className="h-4 w-4" />
                      Down
                    </Button>
                    <span />
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                The adjusted image is generated in your browser, then the server still optimizes it
                to high-quality WebP under {formatBytes(IMAGE_PRESETS[request.preset].maxOutputBytes)}.
              </p>

              <div className="flex flex-wrap gap-2">
                {step === "summary" ? (
                  <Button type="button" variant="brand" onClick={previewAdjustment}>
                    Adjust & upload
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="brand" onClick={() => void adjustAndUpload()}>
                      Upload adjusted image
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setStep("summary")}>
                      Back
                    </Button>
                  </>
                )}
                <Button type="button" variant="outline" onClick={() => close(request.file)}>
                  Upload original
                </Button>
                <Button type="button" variant="ghost" onClick={() => close(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );

  return { prepare, node };
}

function AdjustedImagePreview({
  request,
  position,
  zoom,
}: {
  request: AdjustmentRequest;
  position: AdjustmentPosition;
  zoom: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawAdjustedImage(ctx, img, request.meta, request.plan, position, zoom);
    };
    img.src = request.meta.url;

    return () => {
      cancelled = true;
    };
  }, [position, request, zoom]);

  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border bg-black">
      <canvas
        ref={canvasRef}
        width={request.plan.targetWidth}
        height={request.plan.targetHeight}
        className="block h-auto w-full"
      />
      <div className="pointer-events-none absolute inset-0 border border-white/30" />
    </div>
  );
}

function readImageMeta(file: File): Promise<ImageMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions."));
    };
    img.src = url;
  });
}

function createAdjustmentPlan(meta: ImageMeta, preset: ImagePreset): AdjustmentPlan {
  const rules = IMAGE_PRESETS[preset];
  const aspect = meta.width / meta.height;
  const finalFrame =
    preset === "event"
      ? { width: 800, height: 600, label: "event photo card" }
      : { width: 1200, height: 750, label: "venue cover" };
  const targetAspect = finalFrame.width / finalFrame.height;
  const reasons: string[] = [];

  if (meta.width < rules.minWidth || meta.height < rules.minHeight) {
    reasons.push(
      `Low resolution: minimum is ${rules.minWidth}×${rules.minHeight}px.`
    );
  }
  if (Math.max(meta.width, meta.height) > rules.maxLongEdge) {
    reasons.push(`Very large image: longest edge will be reduced to ${rules.maxLongEdge}px.`);
  }
  if (aspect < rules.minAspect || aspect > rules.maxAspect) {
    reasons.push(
      preset === "venue"
        ? "Aspect ratio should be a landscape venue cover."
        : "Aspect ratio should fit between portrait poster and wide event banner."
    );
  }
  if (Math.abs(aspect - targetAspect) > 0.01) {
    reasons.push(
      preset === "event"
        ? "Event photos display in a 4:3 landscape card; preview and position the crop before upload."
        : "Venue covers display in a landscape frame; preview and position the crop before upload."
    );
  }

  const targetWidth = finalFrame.width;
  const targetHeight = finalFrame.height;

  return {
    needed: reasons.length > 0,
    reasons,
    targetWidth,
    targetHeight,
    previewLabel: finalFrame.label,
    scaleLabel:
      Math.abs(aspect - targetAspect) > 0.01
        ? "Smart crop/resize"
        : meta.width < rules.minWidth || meta.height < rules.minHeight
        ? "Upscale/resize"
        : "Downscale/optimize",
  };
}

async function buildAdjustedImageFile(
  file: File,
  meta: ImageMeta,
  plan: AdjustmentPlan,
  position: AdjustmentPosition = { x: 0, y: 0 },
  zoom = 1
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = plan.targetWidth;
  canvas.height = plan.targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image adjustment.");

  drawAdjustedImage(ctx, bitmap, meta, plan, position, zoom);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("Could not export adjusted image."))),
      "image/jpeg",
      0.92
    );
  });

  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${base}-adjusted.jpg`, { type: "image/jpeg" });
}

function drawAdjustedImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  meta: ImageMeta,
  plan: AdjustmentPlan,
  position: AdjustmentPosition,
  zoom: number
) {
  ctx.fillStyle = "#0b0b0f";
  ctx.fillRect(0, 0, plan.targetWidth, plan.targetHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const srcAspect = meta.width / meta.height;
  const dstAspect = plan.targetWidth / plan.targetHeight;
  let sx = 0;
  let sy = 0;
  let sw = meta.width;
  let sh = meta.height;

  if (srcAspect > dstAspect) {
    sw = Math.round(meta.height * dstAspect);
  } else if (srcAspect < dstAspect) {
    sh = Math.round(meta.width / dstAspect);
  }

  const safeZoom = clamp(zoom, 1, 2);
  sw = Math.max(1, Math.round(sw / safeZoom));
  sh = Math.max(1, Math.round(sh / safeZoom));

  const maxSx = Math.max(0, meta.width - sw);
  const maxSy = Math.max(0, meta.height - sh);
  sx = Math.round(maxSx * ((position.x + 1) / 2));
  sy = Math.round(maxSy * ((position.y + 1) / 2));

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, plan.targetWidth, plan.targetHeight);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
