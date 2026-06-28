"use client";

import * as React from "react";
import { Maximize2, Move, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 6;
const FIT_PADDING = 16;

function initialZoomForSeatCount(seatCount: number): number {
  if (seatCount > 1200) return 0.25;
  if (seatCount > 800) return 0.32;
  if (seatCount > 400) return 0.45;
  if (seatCount > 150) return 0.65;
  return 1;
}

function computeFitView(
  containerW: number,
  containerH: number,
  contentW: number,
  contentH: number,
  padding = FIT_PADDING,
  fluidWidth = false,
  minZoom?: number
): { zoom: number; pan: { x: number; y: number } } {
  if (containerW <= 0 || containerH <= 0 || contentW <= 0 || contentH <= 0) {
    return { zoom: minZoom ?? 1, pan: { x: 0, y: 0 } };
  }
  const availW = containerW - padding;
  const availH = containerH - padding;
  const logicalW = fluidWidth ? availW : contentW;
  const logicalH = fluidWidth ? availW * (contentH / contentW) : contentH;
  const fitScale = Math.min(availW / logicalW, availH / logicalH, MAX_ZOOM);
  let zoom = Math.max(MIN_ZOOM, fitScale);
  if (minZoom != null) zoom = Math.max(zoom, minZoom);
  zoom = Math.min(MAX_ZOOM, zoom);
  const scaledW = logicalW * zoom;
  const scaledH = logicalH * zoom;
  const fitsHeight = scaledH <= availH;
  return {
    zoom,
    pan: {
      x: Math.max(0, (containerW - scaledW) / 2),
      y: fitsHeight ? Math.max(0, (containerH - scaledH) / 2) : padding / 2,
    },
  };
}

type SeatMapZoomContextValue = {
  zoom: number;
  simplified: boolean;
  panMode: boolean;
  canPan: boolean;
  setPanMode: (v: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
};

export const SeatMapZoomContext = React.createContext<SeatMapZoomContextValue | null>(null);

export function useSeatMapZoom() {
  return React.useContext(SeatMapZoomContext);
}

type Props = {
  children: React.ReactNode;
  className?: string;
  minHeight?: number;
  seatCount?: number;
  showLargeMapHint?: boolean;
  /** Customer seat picking: always render individual seats (never overview blocks). */
  forceDetailedSeats?: boolean;
  /** Designer: start zoomed out for large maps. Defaults from seatCount when omitted. */
  initialZoom?: number;
  /** Logical map size - fit-to-view on load uses width/height ratio. */
  contentSize?: { width: number; height: number };
  /** When true, map content uses fluid width (customer picker). When false, native pixel size (designer). */
  fluidContent?: boolean;
  /** Floor for first-load zoom (customer picker - keeps seats readable). Reset/fit ignores this. */
  minInitialZoom?: number;
};

function pointerCentroid(pointers: Map<number, { x: number; y: number }>) {
  const pts = [...pointers.values()];
  if (pts.length === 0) return { x: 0, y: 0 };
  const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / pts.length, y: sum.y / pts.length };
}

export function SeatMapViewport({
  children,
  className,
  minHeight = 440,
  seatCount = 0,
  showLargeMapHint = true,
  forceDetailedSeats = false,
  initialZoom,
  contentSize,
  fluidContent = false,
  minInitialZoom,
}: Props) {
  const [zoom, setZoom] = React.useState(() => {
    if (contentSize && minInitialZoom != null) return minInitialZoom;
    if (contentSize) return 1;
    if (forceDetailedSeats && seatCount > 150) return 0.75;
    return initialZoom ?? initialZoomForSeatCount(seatCount);
  });
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = React.useState(false);
  const [spacePan, setSpacePan] = React.useState(false);
  const [touchPanning, setTouchPanning] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentSizeRef = React.useRef(contentSize);
  contentSizeRef.current = contentSize;
  const fluidContentRef = React.useRef(fluidContent);
  fluidContentRef.current = fluidContent;
  const minInitialZoomRef = React.useRef(minInitialZoom);
  minInitialZoomRef.current = minInitialZoom;
  const panRef = React.useRef(pan);
  const dragRef = React.useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pointersRef = React.useRef(new Map<number, { x: number; y: number }>());
  const multiPanRef = React.useRef<{
    centroidX: number;
    centroidY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const zoomRef = React.useRef(zoom);
  React.useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
  }, [pan, zoom]);

  const isLarge = seatCount > 400;
  const simplified = !forceDetailedSeats && isLarge && zoom < 0.85;

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const zoomByFactor = React.useCallback((factor: number) => {
    const el = containerRef.current;
    setZoom((z) => {
      const next = clampZoom(z * factor);
      if (el && next !== z) {
        const cx = el.clientWidth / 2;
        const cy = el.clientHeight / 2;
        setPan((p) => ({
          x: cx - (cx - p.x) * (next / z),
          y: cy - (cy - p.y) * (next / z),
        }));
      }
      return next;
    });
  }, []);

  const applyFitToView = React.useCallback((useMinZoom = false) => {
    const el = containerRef.current;
    const size = contentSizeRef.current;
    if (!el || !size) return;
    const { zoom: z, pan: p } = computeFitView(
      el.clientWidth,
      el.clientHeight,
      size.width,
      size.height,
      FIT_PADDING,
      fluidContentRef.current,
      useMinZoom ? minInitialZoomRef.current : undefined
    );
    setZoom(z);
    setPan(p);
  }, []);

  const zoomIn = React.useCallback(() => zoomByFactor(1.25), [zoomByFactor]);
  const zoomOut = React.useCallback(() => zoomByFactor(1 / 1.25), [zoomByFactor]);
  const resetView = React.useCallback(() => {
    if (contentSizeRef.current) {
      applyFitToView(false);
      return;
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [applyFitToView]);

  const fitKey = contentSize ? `${contentSize.width}x${contentSize.height}` : null;
  const appliedFitKeyRef = React.useRef<string | null>(null);

  /** Initial fit once per layout size - do not reset on unrelated parent re-renders. */
  React.useLayoutEffect(() => {
    if (!fitKey) return;
    if (appliedFitKeyRef.current === fitKey) return;
    appliedFitKeyRef.current = fitKey;
    applyFitToView(true);
  }, [fitKey, applyFitToView]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setSpacePan(true);
      }
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "0") resetView();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePan(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [zoomIn, zoomOut, resetView]);

  /** Wheel pans; Ctrl/Cmd + wheel zooms (trackpad pinch). */
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const z = zoomRef.current;
        const next = clampZoom(z * factor);
        if (next !== z) {
          const rect = el.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          setPan((p) => ({
            x: cx - (cx - p.x) * (next / z),
            y: cy - (cy - p.y) * (next / z),
          }));
          setZoom(next);
        }
        return;
      }
      e.preventDefault();
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const canPan = panMode || spacePan;

  const beginMultiPan = () => {
    const c = pointerCentroid(pointersRef.current);
    multiPanRef.current = {
      centroidX: c.x,
      centroidY: c.y,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    dragRef.current = null;
    setTouchPanning(true);
  };

  const onPointerDownCapture = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
      beginMultiPan();
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (pointersRef.current.size >= 2) return;
    if (!canPan || e.button !== 0) return;
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (multiPanRef.current && pointersRef.current.size >= 2) {
      const c = pointerCentroid(pointersRef.current);
      setPan({
        x: multiPanRef.current.panX + (c.x - multiPanRef.current.centroidX),
        y: multiPanRef.current.panY + (c.y - multiPanRef.current.centroidY),
      });
      return;
    }

    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.x),
      y: dragRef.current.panY + (e.clientY - dragRef.current.y),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size < 2) {
      multiPanRef.current = null;
      setTouchPanning(false);
    } else if (multiPanRef.current) {
      beginMultiPan();
    }

    dragRef.current = null;
  };

  const ctx: SeatMapZoomContextValue = {
    zoom,
    simplified,
    panMode,
    canPan: canPan || touchPanning,
    setPanMode,
    zoomIn,
    zoomOut,
    resetView,
  };

  const innerMinH = showLargeMapHint && isLarge ? minHeight - 36 : minHeight;

  return (
    <SeatMapZoomContext.Provider value={ctx}>
      <div className={cn("relative w-full max-w-full overflow-hidden rounded-xl border bg-muted/20", className)}>
        {showLargeMapHint && isLarge && (
          <p className="border-b border-border/60 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
            {seatCount.toLocaleString()} seats -{" "}
            <kbd className="rounded border px-1 text-[10px]">Ctrl</kbd>+scroll to zoom, two-finger
            drag to pan on tablet, or hold <kbd className="rounded border px-1 text-[10px]">Space</kbd>{" "}
            / tap <Move className="inline h-3 w-3" /> on desktop.
          </p>
        )}

        <div
          ref={containerRef}
          className={cn(
            "relative w-full max-w-full touch-none overflow-hidden",
            canPan || touchPanning ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          )}
          style={{ minHeight: innerMinH, maxHeight: innerMinH }}
          onPointerDownCapture={onPointerDownCapture}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div
            className={cn(
              "absolute left-0 top-0 origin-top-left p-2",
              fluidContent ? "w-full" : "inline-block"
            )}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {children}
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border bg-background/95 p-1 shadow-md backdrop-blur">
            <Button
              type="button"
              variant={panMode ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              title="Pan mode (desktop: hold Space; tablet: two-finger drag)"
              onClick={(e) => {
                e.stopPropagation();
                setPanMode((p) => !p);
              }}
            >
              <Move className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                zoomOut();
              }}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="min-w-[44px] text-center text-xs font-medium tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                zoomIn();
              }}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Fit to view"
              onClick={(e) => {
                e.stopPropagation();
                resetView();
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {simplified && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-200">
            Overview mode - Ctrl+scroll or + to zoom in for seat detail
          </div>
        )}
      </div>
    </SeatMapZoomContext.Provider>
  );
}
