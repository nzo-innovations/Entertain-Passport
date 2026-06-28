"use client";

import * as React from "react";
import type { SeatLayoutDocument, LayoutLandmark, LayoutSection } from "@/lib/seating/types";
import {
  computeLayoutExtents,
  countLayoutSeats,
  enumerateSectionSeats,
  getSectionBounds,
} from "@/lib/seating/layout-utils";
import { getTablePackLayout, getTablePackSize } from "@/lib/seating/table-pack";
import { useSeatMapZoom } from "./seat-map-viewport";
import {
  SEAT_BOOKED_FILL,
  SEAT_DEFAULT_TIER_COLOR,
  SEAT_HELD_FILL,
  SEAT_SELECTED_FILL,
  SEAT_SELECTED_STROKE,
  seatStatusFill,
  seatStatusStroke,
  seatStatusStrokeWidth,
} from "@/lib/seating/seat-colors";
import { getGridSeatPosition, resolveRowLayout, getLayoutFocal } from "@/lib/seating/row-layout";
import { getVenueZones, venueZoneKindLabel, venueZoneStyle, zoneDisplayName } from "@/lib/seating/venue-zones";
import {
  isStandingZone,
  isWedgeZone,
  wedgeSvgPath,
  zoneFocal,
} from "@/lib/seating/round-zones";
import { sectionAisleLineX } from "@/lib/seating/layout-builders";
import { countSectionGridSeats } from "@/lib/seating/section-helpers";
import type { LayoutVenueZone, SeatShape } from "@/lib/seating/types";
import {
  isRingCurvedSection,
  moveRingSectionPolar,
  rotateRingSection,
} from "@/lib/seating/ring-section-sync";
import {
  landmarkBounds,
  resizeLandmark,
  resizeSection,
  resizeZoneRect,
  rotateTarget,
  zoneRectBounds,
} from "@/lib/seating/designer-transform";
import {
  DesignerTransformHandles,
  Round360Guides,
  type TransformHandle,
} from "./designer-transform-handles";
import { cn, formatCurrency } from "@/lib/utils";

export type SeatVisualStatus = "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED" | "SELECTED" | "DISABLED";

type SeatStatusMap = Record<string, SeatVisualStatus>;

type Props = {
  layout: SeatLayoutDocument;
  seatStatus?: SeatStatusMap;
  selectedIds?: Set<string>;
  onSeatClick?: (externalId: string) => void;
  /** Designer: highlight & click sections / landmarks */
  designerMode?: boolean;
  selectedSectionId?: string | null;
  selectedLandmarkId?: string | null;
  selectedZoneId?: string | null;
  onSectionClick?: (sectionId: string) => void;
  onLandmarkClick?: (landmarkId: string) => void;
  onZoneClick?: (zoneId: string) => void;
  onSectionMove?: (
    sectionId: string,
    x: number,
    y: number,
    meta?: { polar?: boolean; deltaX: number; deltaY: number }
  ) => void;
  onLandmarkMove?: (landmarkId: string, x: number, y: number) => void;
  onZoneMove?: (zoneId: string, x: number, y: number) => void;
  onSectionUpdate?: (sectionId: string, data: Partial<LayoutSection>) => void;
  onZoneUpdate?: (zoneId: string, data: Partial<LayoutVenueZone>) => void;
  onLandmarkUpdate?: (landmarkId: string, data: Partial<LayoutLandmark>) => void;
  /** Designer: multi-select seats to assign pricing tier groups */
  groupSelectMode?: boolean;
  groupedSeatKeys?: Set<string>;
  onSeatGroupToggle?: (sectionId: string, seatId: string) => void;
  interactive?: boolean;
  /** Inside SeatMapViewport - skip outer chrome */
  embedded?: boolean;
  className?: string;
};

function screenToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const mapped = pt.matrixTransform(ctm.inverse());
  return { x: mapped.x, y: mapped.y };
}

type DragTarget =
  | { kind: "section"; id: string }
  | { kind: "landmark"; id: string }
  | { kind: "zone"; id: string };

function LandmarkShape({
  lm,
  selected,
  onClick,
  designerMode,
  onDragStart,
}: {
  lm: LayoutLandmark;
  selected?: boolean;
  onClick?: () => void;
  designerMode?: boolean;
  onDragStart?: (e: React.PointerEvent) => void;
}) {
  const dragProps =
    designerMode && onDragStart
      ? {
          onPointerDown: onDragStart,
          style: { cursor: "move" as const },
        }
      : {};

  if (lm.type === "STAGE_ROUND" && lm.radius) {
    return (
      <g
        onClick={onClick}
        className={onClick || onDragStart ? "cursor-move" : undefined}
        {...dragProps}
      >
        <circle
          cx={lm.x}
          cy={lm.y}
          r={lm.radius}
          className={cn("fill-muted stroke-border", selected && "stroke-primary stroke-[3]")}
          strokeWidth={selected ? 3 : 2}
        />
        {lm.label && (
          <text
            x={lm.x}
            y={lm.y + 4}
            textAnchor="middle"
            className="fill-foreground text-[11px] font-semibold pointer-events-none"
          >
            {lm.label}
          </text>
        )}
      </g>
    );
  }
  const w = lm.width ?? 120;
  const h = lm.height ?? 48;
  return (
    <g
      onClick={onClick}
      className={onClick || onDragStart ? "cursor-move" : undefined}
      {...dragProps}
    >
      <rect
        x={lm.x}
        y={lm.y}
        width={w}
        height={h}
        rx={lm.type === "SCREEN" ? 2 : 6}
        className={cn(
          lm.type === "SCREEN" ? "fill-slate-400/80" : "fill-primary/15 stroke-primary/40",
          selected && "stroke-primary stroke-[3]"
        )}
        strokeWidth={selected ? 3 : lm.type === "SCREEN" ? 0 : 2}
      />
      {lm.label && (
        <text
          x={lm.x + w / 2}
          y={lm.y + h / 2 + 4}
          textAnchor="middle"
          className="fill-foreground text-[11px] font-semibold pointer-events-none"
        >
          {lm.label}
        </text>
      )}
    </g>
  );
}

function SeatIcon({
  x,
  y,
  sw,
  sh,
  shape,
  fill,
  stroke,
  strokeWidth,
  opacity,
  className,
  onClick,
  title,
}: {
  x: number;
  y: number;
  sw: number;
  sh: number;
  shape?: SeatShape;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const common = {
    fill,
    stroke,
    strokeWidth,
    opacity,
    className,
    onClick,
  };
  if (shape === "ROUND") {
    const r = Math.min(sw, sh) / 2 - 1;
    return (
      <circle cx={x + sw / 2} cy={y + sh / 2} r={r} {...common}>
        {title ? <title>{title}</title> : null}
      </circle>
    );
  }
  return (
    <rect x={x} y={y} width={sw} height={sh} rx={3} {...common}>
      {title ? <title>{title}</title> : null}
    </rect>
  );
}

function renderSectionSeats(
  section: LayoutSection,
  layout: SeatLayoutDocument,
  catColors: Map<string, string>,
  opts: {
    seatStatus: Record<string, SeatVisualStatus>;
    selectedIds?: Set<string>;
    onSeatClick?: (id: string) => void;
    interactive: boolean;
    designerMode: boolean;
    simplified: boolean;
    groupSelectMode?: boolean;
    groupedSeatKeys?: Set<string>;
    onSeatGroupToggle?: (sectionId: string, seatId: string) => void;
  }
) {
  const sw = section.seatWidth ?? 22;
  const sh = section.seatHeight ?? 22;
  const bounds = getSectionBounds(section, layout);
  const catId = section.categoryId;
  const color = catColors.get(catId) ?? SEAT_DEFAULT_TIER_COLOR;
  const overviewX = bounds.boxX != null ? bounds.boxX + 4 : section.x;
  const overviewY = bounds.boxY != null ? bounds.boxY + 16 : section.y;

  if (opts.simplified) {
    const seatCount =
      section.kind === "TABLE" ? getTablePackSize(section) : countSectionGridSeats(section);
    return (
      <g className={opts.designerMode ? "pointer-events-none" : undefined}>
        <rect
          x={overviewX}
          y={overviewY}
          width={bounds.w - 8}
          height={bounds.h - 20}
          rx={section.kind === "TABLE" ? 10 : 4}
          fill={color}
          opacity={0.4}
          stroke={color}
          strokeWidth={1}
        />
        <text
          x={overviewX + (bounds.w - 8) / 2}
          y={overviewY + (bounds.h - 20) / 2 - 4}
          textAnchor="middle"
          className="fill-foreground text-[10px] font-semibold"
        >
          {section.name}
        </text>
        <text
          x={overviewX + (bounds.w - 8) / 2}
          y={overviewY + (bounds.h - 20) / 2 + 10}
          textAnchor="middle"
          className="fill-muted-foreground text-[9px]"
        >
          {seatCount.toLocaleString()} seats
        </text>
      </g>
    );
  }

  if (section.kind === "TABLE") {
    const geom = getTablePackLayout(section, sw);
    const seats = enumerateSectionSeats(section, layout);

    return (
      <>
        {geom.tableShape === "ellipse" ? (
          <ellipse
            cx={geom.tableCx}
            cy={geom.tableCy}
            rx={geom.tableW / 2 + 4}
            ry={geom.tableH / 2 + 4}
            className="fill-amber-900/25 stroke-amber-700/50"
            strokeWidth={1.5}
          />
        ) : (
          <rect
            x={geom.tableCx - geom.tableW / 2}
            y={geom.tableCy - geom.tableH / 2}
            width={geom.tableW}
            height={geom.tableH}
            rx={6}
            className="fill-amber-900/25 stroke-amber-700/50"
            strokeWidth={1.5}
          />
        )}
        <text
          x={geom.tableCx}
          y={geom.tableCy + 4}
          textAnchor="middle"
          className="fill-amber-100/90 text-[9px] font-semibold"
        >
          TABLE
        </text>
        {geom.sideMode === "TWO" && (
          <text
            x={geom.tableCx}
            y={geom.tableCy - geom.tableH / 2 - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[8px]"
          >
            2 sides
          </text>
        )}
        {seats.map((seat) => {
          const pos = geom.seats[seat.colIndex];
          if (!pos) return null;
          const catId = seat.categoryId ?? section.categoryId;
          const color = catColors.get(catId) ?? SEAT_DEFAULT_TIER_COLOR;
          const st =
            opts.selectedIds?.has(seat.id)
              ? "SELECTED"
              : opts.seatStatus[seat.id] ?? (seat.enabled ? "AVAILABLE" : "DISABLED");
          const clickable =
            opts.interactive &&
            !opts.simplified &&
            opts.onSeatClick &&
            st !== "SOLD" &&
            st !== "HELD" &&
            st !== "BLOCKED";

          return (
            <SeatIcon
              key={seat.id}
              x={pos.x}
              y={pos.y}
              sw={sw}
              sh={sh}
              shape={section.seatShape}
              fill={seatStatusFill(st, color)}
              stroke={seatStatusStroke(st) ?? "transparent"}
              strokeWidth={seatStatusStrokeWidth(st)}
              opacity={st === "DISABLED" ? 0.35 : 1}
              className={cn(clickable && "cursor-pointer hover:opacity-80", opts.designerMode && "pointer-events-none")}
              onClick={clickable ? () => opts.onSeatClick!(seat.id) : undefined}
              title={seat.label}
            />
          );
        })}
      </>
    );
  }

  const seats = enumerateSectionSeats(section, layout);
  const curved = resolveRowLayout(section, layout) === "CURVED";
  const aisleX = sectionAisleLineX(section);

  const seatNodes = seats.map((seat) => {
    const pos = getGridSeatPosition(section, seat.rowIndex, seat.colIndex, layout);
    const x = pos.x;
    const y = pos.y;
    const catId = seat.categoryId ?? section.categoryId;
    const color = catColors.get(catId) ?? SEAT_DEFAULT_TIER_COLOR;
    const st =
      opts.selectedIds?.has(seat.id)
        ? "SELECTED"
        : opts.seatStatus[seat.id] ?? (seat.enabled ? "AVAILABLE" : "DISABLED");
    const grouped = opts.groupedSeatKeys?.has(`${section.id}:${seat.id}`);
    const groupClickable = opts.groupSelectMode && opts.onSeatGroupToggle;
    const clickable =
      groupClickable ||
      (opts.interactive &&
        !opts.simplified &&
        opts.onSeatClick &&
        st !== "SOLD" &&
        st !== "HELD" &&
        st !== "BLOCKED");
    const pointerEvents =
      opts.groupSelectMode || (clickable && !opts.designerMode) ? undefined : opts.designerMode;

    const seatNode = (
      <SeatIcon
        x={x}
        y={y}
        sw={sw}
        sh={sh}
        shape={section.seatShape}
        fill={seatStatusFill(st, color)}
        stroke={grouped ? SEAT_SELECTED_STROKE : seatStatusStroke(st) ?? "transparent"}
        strokeWidth={grouped ? 2.5 : seatStatusStrokeWidth(st)}
        opacity={st === "DISABLED" ? 0.35 : 1}
        className={cn(
          clickable && "cursor-pointer hover:opacity-80",
          pointerEvents === undefined ? undefined : "pointer-events-none"
        )}
        onClick={
          groupClickable
            ? () => opts.onSeatGroupToggle!(section.id, seat.id)
            : clickable
              ? () => opts.onSeatClick!(seat.id)
              : undefined
        }
        title={seat.label}
      />
    );

    if (curved && pos.rotate !== 0) {
      return (
        <g
          key={seat.id}
          transform={`rotate(${pos.rotate}, ${x + sw / 2}, ${y + sh / 2})`}
        >
          {seatNode}
        </g>
      );
    }

    return (
      <g key={seat.id}>
        {seatNode}
      </g>
    );
  });

  return (
    <>
      {seatNodes}
      {aisleX != null && !curved && (
        <line
          x1={section.x + aisleX}
          y1={section.y - 4}
          x2={section.x + aisleX}
          y2={section.y + bounds.h}
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          className="pointer-events-none"
        />
      )}
    </>
  );
}

export function SeatLayoutPreview({
  layout,
  seatStatus = {},
  selectedIds,
  onSeatClick,
  designerMode = false,
  selectedSectionId,
  selectedLandmarkId,
  selectedZoneId,
  onSectionClick,
  onLandmarkClick,
  onZoneClick,
  onSectionMove,
  onLandmarkMove,
  onZoneMove,
  onSectionUpdate,
  onZoneUpdate,
  onLandmarkUpdate,
  groupSelectMode = false,
  groupedSeatKeys,
  onSeatGroupToggle,
  interactive = false,
  embedded = false,
  className,
}: Props) {
  const zoomCtx = useSeatMapZoom();
  const simplified = zoomCtx?.simplified ?? false;
  const canPan = zoomCtx?.canPan ?? false;
  const canDrag =
    designerMode &&
    !canPan &&
    !groupSelectMode &&
    !!(onSectionMove || onLandmarkMove || onZoneMove || onSectionUpdate);

  const svgRef = React.useRef<SVGSVGElement>(null);
  const transformRef = React.useRef<{
    handle: TransformHandle;
    target: DragTarget;
    svgX: number;
    svgY: number;
    originX: number;
    originY: number;
    rotateCx?: number;
    rotateCy?: number;
    startAngle?: number;
    baseRotate?: number;
  } | null>(null);
  const dragOffsetRef = React.useRef({ x: 0, y: 0 });
  const movedRef = React.useRef(false);
  const [livePatch, setLivePatch] = React.useState<{
    target: DragTarget;
    data: Record<string, unknown>;
  } | null>(null);
  const [dragVisual, setDragVisual] = React.useState<{ target: DragTarget; x: number; y: number } | null>(
    null
  );

  const getDragOffset = (target: DragTarget) => {
    if (
      !dragVisual ||
      dragVisual.target.kind !== target.kind ||
      dragVisual.target.id !== target.id
    ) {
      return { x: 0, y: 0 };
    }
    return { x: dragVisual.x, y: dragVisual.y };
  };

  const beginTransform = (
    handle: TransformHandle,
    target: DragTarget,
    originX: number,
    originY: number,
    e: React.PointerEvent,
    rotateCx?: number,
    rotateCy?: number,
    baseRotate?: number
  ) => {
    if (!canDrag || !svgRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
    transformRef.current = {
      handle,
      target,
      svgX: pt.x,
      svgY: pt.y,
      originX,
      originY,
      rotateCx,
      rotateCy,
      startAngle:
        handle === "rotate" && rotateCx != null && rotateCy != null
          ? Math.atan2(pt.y - rotateCy, pt.x - rotateCx)
          : undefined,
      baseRotate,
    };
    dragOffsetRef.current = { x: 0, y: 0 };
    movedRef.current = false;
    setLivePatch(null);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (target.kind === "section") onSectionClick?.(target.id);
    else if (target.kind === "landmark") onLandmarkClick?.(target.id);
    else onZoneClick?.(target.id);
  };

  const applyLiveTransform = (dx: number, dy: number, pt: { x: number; y: number }) => {
    const session = transformRef.current;
    if (!session) return;

    if (session.handle === "move") {
      if (session.target.kind === "section") {
        const sec = layout.sections.find((s) => s.id === session.target.id);
        if (sec && isRingCurvedSection(sec, layout)) {
          const patch = moveRingSectionPolar(sec, layout, dx, dy);
          setLivePatch({ target: session.target, data: patch as Record<string, unknown> });
          setDragVisual(null);
          return;
        }
      }
      dragOffsetRef.current = { x: dx, y: dy };
      setDragVisual({ target: session.target, x: dx, y: dy });
      setLivePatch(null);
      return;
    }

    if (session.handle === "rotate" && session.rotateCx != null && session.rotateCy != null) {
      const targetSec =
        session.target.kind === "section"
          ? layout.sections.find((s) => s.id === session.target.id)
          : undefined;
      if (targetSec && isRingCurvedSection(targetSec, layout)) {
        const curAngle = Math.atan2(pt.y - session.rotateCy, pt.x - session.rotateCx);
        const startAngle = session.startAngle ?? curAngle;
        const delta = ((curAngle - startAngle) * 180) / Math.PI;
        const patch = rotateRingSection(targetSec, delta);
        setLivePatch({ target: session.target, data: patch as Record<string, unknown> });
      } else {
        const deg = rotateTarget(
          session.baseRotate ?? 0,
          session.rotateCx,
          session.rotateCy,
          session.svgX,
          session.svgY,
          pt.x,
          pt.y
        );
        setLivePatch({ target: session.target, data: { rotateDeg: deg } });
      }
      setDragVisual(null);
      return;
    }

    const resizeHandle = session.handle;
    if (
      resizeHandle !== "resize-nw" &&
      resizeHandle !== "resize-ne" &&
      resizeHandle !== "resize-se" &&
      resizeHandle !== "resize-sw"
    ) {
      return;
    }

    if (session.target.kind === "section") {
      const section = layout.sections.find((s) => s.id === session.target.id);
      if (!section) return;
      const patch = resizeSection(section, resizeHandle, dx, dy);
      setLivePatch({ target: session.target, data: patch as Record<string, unknown> });
    } else if (session.target.kind === "zone") {
      const zone = getVenueZones(layout).find((z) => z.id === session.target.id);
      if (!zone || isWedgeZone(zone)) return;
      const patch = resizeZoneRect(zone, resizeHandle, dx, dy);
      setLivePatch({ target: session.target, data: patch as Record<string, unknown> });
    } else if (session.target.kind === "landmark") {
      const lm = layout.landmarks.find((l) => l.id === session.target.id);
      if (!lm) return;
      const patch = resizeLandmark(lm, resizeHandle, dx, dy);
      setLivePatch({ target: session.target, data: patch as Record<string, unknown> });
    }
    setDragVisual(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!transformRef.current || !svgRef.current) return;
    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
    const dx = pt.x - transformRef.current.svgX;
    const dy = pt.y - transformRef.current.svgY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedRef.current = true;
    applyLiveTransform(dx, dy, pt);
  };

  const commitTransform = () => {
    const session = transformRef.current;
    if (!session) return;
    const wasMoved = movedRef.current;

    if (wasMoved) {
      if (session.handle === "move") {
        const dx = dragOffsetRef.current.x;
        const dy = dragOffsetRef.current.y;
        if (session.target.kind === "section") {
          const sec = layout.sections.find((s) => s.id === session.target.id);
          if (sec && isRingCurvedSection(sec, layout)) {
            onSectionMove?.(session.target.id, sec.x, sec.y, { polar: true, deltaX: dx, deltaY: dy });
          } else {
            onSectionMove?.(
              session.target.id,
              Math.round(session.originX + dx),
              Math.round(session.originY + dy)
            );
          }
        } else if (session.target.kind === "landmark") {
          onLandmarkMove?.(
            session.target.id,
            Math.round(session.originX + dx),
            Math.round(session.originY + dy)
          );
        } else {
          onZoneMove?.(
            session.target.id,
            Math.round(session.originX + dx),
            Math.round(session.originY + dy)
          );
        }
      } else if (livePatch && livePatch.target.kind === session.target.kind && livePatch.target.id === session.target.id) {
        const data = livePatch.data;
        if (session.target.kind === "section") {
          onSectionUpdate?.(session.target.id, data as Partial<LayoutSection>);
        } else if (session.target.kind === "zone") {
          onZoneUpdate?.(session.target.id, data as Partial<LayoutVenueZone>);
        } else if (session.target.kind === "landmark") {
          onLandmarkUpdate?.(session.target.id, data as Partial<LayoutLandmark>);
        }
      }
    }

    transformRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    setDragVisual(null);
    setLivePatch(null);
    if (!wasMoved) movedRef.current = false;
  };

  const handlePointerUp = () => {
    commitTransform();
  };

  const handleSectionClick = (id: string) => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    onSectionClick?.(id);
  };

  const handleLandmarkClick = (id: string) => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    onLandmarkClick?.(id);
  };

  const handleZoneClick = (id: string) => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    onZoneClick?.(id);
  };

  const catColors = React.useMemo(
    () => new Map(layout.categories.map((c) => [c.id, c.color])),
    [layout.categories]
  );

  const extents = React.useMemo(() => computeLayoutExtents(layout), [layout]);
  const totalSeats = React.useMemo(() => countLayoutSeats(layout), [layout]);

  const orientationHint =
    layout.orientation === "FRONT"
      ? "Front view - straight seat rows facing stage"
      : layout.orientation === "360"
        ? "360° - curved rows in the round (centre stage)"
        : `${layout.orientation}° - curved seat rows fan toward stage`;

  const focal = getLayoutFocal(layout);
  const roundStage = layout.landmarks.find((l) => l.type === "STAGE_ROUND");
  const stageR = roundStage?.radius ?? 90;
  const show360Guides = designerMode && layout.orientation === "360" && roundStage;

  const mergeLive = <T extends { id: string }>(entity: T, kind: DragTarget["kind"]): T => {
    if (livePatch?.target.kind === kind && livePatch.target.id === entity.id) {
      return { ...entity, ...livePatch.data } as T;
    }
    return entity;
  };

  const mapBody = (
    <>
      {designerMode && !embedded && (
        <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">{orientationHint}</p>
      )}
      {!embedded && totalSeats > 400 && (
        <p className="mb-2 px-1 text-[11px] text-muted-foreground">
          {totalSeats.toLocaleString()} seats in this layout
        </p>
      )}
      <svg
        ref={svgRef}
        viewBox={`${extents.x} ${extents.y} ${extents.width} ${extents.height}`}
        className={cn(
          designerMode && embedded
            ? "h-auto shrink-0 max-w-none"
            : "mx-auto h-auto w-full max-w-full",
          canDrag && "touch-none select-none"
        )}
        style={
          designerMode && embedded
            ? { width: extents.width, height: extents.height, minWidth: extents.width }
            : undefined
        }
        role="img"
        aria-label={`Seat map: ${layout.name}`}
        onPointerMove={canDrag ? handlePointerMove : undefined}
        onPointerUp={canDrag ? handlePointerUp : undefined}
        onPointerCancel={canDrag ? handlePointerUp : undefined}
      >
        {show360Guides && (
          <Round360Guides
            cx={focal.x}
            cy={focal.y}
            innerR={stageR + 28}
            outerR={stageR + 178}
          />
        )}
        {getVenueZones(layout).map((zone, zi) => {
          const zoneLive = mergeLive(zone, "zone");
          const style = venueZoneStyle(zi);
          const tierColor =
            layout.categories.find((c) => c.id === zone.categoryId)?.color ?? style.stroke;
          const isSelected = designerMode && selectedZoneId === zone.id;
          const offset = getDragOffset({ kind: "zone", id: zone.id });
          const isDragging =
            dragVisual?.target.kind === "zone" && dragVisual.target.id === zone.id;
          const standing = isStandingZone(zoneLive);
          const wedge = isWedgeZone(zoneLive);
          const zoneF = zoneFocal(layout, zoneLive);
          const innerR = zoneLive.innerRadius ?? 80;
          const outerR = zoneLive.outerRadius ?? 200;
          const startDeg = zoneLive.wedgeStartDeg ?? 0;
          const endDeg = zoneLive.wedgeEndDeg ?? 90;
          const wedgePath =
            wedge && zoneLive.innerRadius != null
              ? wedgeSvgPath(zoneF.x, zoneF.y, innerR, outerR, startDeg, endDeg)
              : null;
          const canDragZone = designerMode && canDrag && (onZoneMove || onZoneUpdate) && !wedge;
          const zb = zoneRectBounds(zoneLive);

          return (
            <g
              key={zone.id}
              transform={offset.x || offset.y ? `translate(${offset.x}, ${offset.y})` : undefined}
              style={isDragging ? { opacity: 0.92 } : undefined}
            >
              {wedgePath ? (
                <path
                  d={wedgePath}
                  fill={standing ? `${tierColor}22` : style.fill}
                  stroke={isSelected ? "#7c3aed" : tierColor}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  strokeDasharray={standing ? "6 4" : designerMode && !isSelected ? "8 5" : undefined}
                  onClick={designerMode ? () => handleZoneClick(zone.id) : undefined}
                />
              ) : (
                <>
                  <rect
                    x={zoneLive.x}
                    y={zoneLive.y}
                    width={zoneLive.width}
                    height={zoneLive.height}
                    rx={10}
                    fill={standing ? `${tierColor}22` : style.fill}
                    stroke={isSelected ? "transparent" : tierColor}
                    strokeWidth={isSelected ? 0 : 1.5}
                    strokeDasharray={standing ? "6 4" : designerMode && !isSelected ? "8 5" : undefined}
                    onClick={designerMode ? () => handleZoneClick(zone.id) : undefined}
                  />
                  {isSelected && canDragZone && (
                    <DesignerTransformHandles
                      x={zb.x}
                      y={zb.y}
                      width={zb.w}
                      height={zb.h}
                      rotateDeg={zoneLive.rotateDeg ?? 0}
                      selected
                      onHandlePointerDown={(handle, e) =>
                        beginTransform(
                          handle,
                          { kind: "zone", id: zone.id },
                          zone.x,
                          zone.y,
                          e,
                          zb.x + zb.w / 2,
                          zb.y + zb.h / 2,
                          zone.rotateDeg ?? 0
                        )
                      }
                    />
                  )}
                </>
              )}
              {standing && wedgePath && (
                <text
                  x={zoneF.x}
                  y={zoneF.y + (innerR + outerR) / 2}
                  textAnchor="middle"
                  className="pointer-events-none fill-foreground text-[11px] font-bold"
                >
                  STAND
                </text>
              )}
              <text
                x={wedgePath ? zoneF.x : zoneLive.x + 12}
                y={wedgePath ? zoneF.y + innerR + 18 : zoneLive.y + 20}
                textAnchor={wedgePath ? "middle" : "start"}
                className="pointer-events-none fill-foreground text-[12px] font-semibold"
              >
                {zone.name}
              </text>
              <text
                x={wedgePath ? zoneF.x : zoneLive.x + 12}
                y={wedgePath ? zoneF.y + innerR + 32 : zoneLive.y + 34}
                textAnchor={wedgePath ? "middle" : "start"}
                className="pointer-events-none fill-muted-foreground text-[9px]"
              >
                {standing
                  ? `Stand-up · ${(zoneLive.capacity ?? 0).toLocaleString()} cap`
                  : zone.parentZoneId
                    ? `Sub-zone · ${venueZoneKindLabel(zone.kind)}`
                    : venueZoneKindLabel(zone.kind)}
              </text>
            </g>
          );
        })}

        {layout.landmarks.map((rawLm) => {
          const lm = mergeLive(rawLm, "landmark");
          const offset = getDragOffset({ kind: "landmark", id: lm.id });
          const isDragging =
            dragVisual?.target.kind === "landmark" && dragVisual.target.id === lm.id;
          const isSelected = designerMode && selectedLandmarkId === lm.id;
          const lb = landmarkBounds(lm);
          return (
            <g
              key={lm.id}
              transform={offset.x || offset.y ? `translate(${offset.x}, ${offset.y})` : undefined}
              style={isDragging ? { opacity: 0.92 } : undefined}
            >
              <LandmarkShape
                lm={lm}
                selected={isSelected}
                designerMode={designerMode}
                onClick={
                  designerMode && onLandmarkClick
                    ? () => handleLandmarkClick(lm.id)
                    : undefined
                }
              />
              {isSelected && canDrag && (
                <DesignerTransformHandles
                  x={lb.x}
                  y={lb.y}
                  width={lb.w}
                  height={lb.h}
                  rotateDeg={lm.rotateDeg ?? 0}
                  selected
                  onHandlePointerDown={(handle, e) =>
                    beginTransform(
                      handle,
                      { kind: "landmark", id: lm.id },
                      lm.x,
                      lm.y,
                      e,
                      lb.x + lb.w / 2,
                      lb.y + lb.h / 2,
                      lm.rotateDeg ?? 0
                    )
                  }
                />
              )}
            </g>
          );
        })}

        {layout.sections.map((rawSection) => {
          const section = mergeLive(rawSection, "section");
          const bounds = getSectionBounds(section, layout);
          const isSelected = designerMode && selectedSectionId === section.id;
          const offset = getDragOffset({ kind: "section", id: section.id });
          const isDragging =
            dragVisual?.target.kind === "section" && dragVisual.target.id === section.id;
          const hitX = bounds.boxX ?? section.x - 4;
          const hitY = bounds.boxY ?? section.y - 16;
          const labelX = bounds.boxX != null ? bounds.boxX + 4 : section.x;
          const labelY = bounds.boxY != null ? bounds.boxY + 12 : section.y - 8;
          const ringCurved = isRingCurvedSection(section, layout);
          const rot = ringCurved ? 0 : (section.rotateDeg ?? 0);
          const handleAngle = ringCurved ? (section.curveBearingDeg ?? 0) : rot;
          const cx = hitX + bounds.w / 2;
          const cy = hitY + bounds.h / 2;

          if (!section.enabled && !designerMode) return null;

          return (
            <g
              key={section.id}
              transform={offset.x || offset.y ? `translate(${offset.x}, ${offset.y})` : undefined}
              style={isDragging ? { opacity: 0.92 } : undefined}
            >
              <g transform={rot ? `rotate(${rot}, ${cx}, ${cy})` : undefined}>
                {(section.enabled || designerMode) &&
                  renderSectionSeats(section, layout, catColors, {
                    seatStatus,
                    selectedIds,
                    onSeatClick,
                    interactive,
                    designerMode,
                    simplified,
                    groupSelectMode,
                    groupedSeatKeys,
                    onSeatGroupToggle,
                  })}
                {(section.enabled || designerMode) && (
                  <text
                    x={labelX}
                    y={labelY}
                    className={cn(
                      "pointer-events-none text-[10px] font-medium",
                      section.enabled ? "fill-muted-foreground" : "fill-muted-foreground/50"
                    )}
                  >
                    {section.name}
                    {bounds.labelSuffix}
                    {section.zoneId && layout.zones?.length
                      ? ` · ${layout.zones.find((z) => z.id === section.zoneId)?.name ?? ""}`
                      : ""}
                    {!section.enabled ? " [off]" : ""}
                  </text>
                )}
              </g>
              {designerMode && isSelected && canDrag && (
                <DesignerTransformHandles
                  x={hitX}
                  y={hitY}
                  width={bounds.w}
                  height={bounds.h}
                  rotateDeg={handleAngle}
                  selected
                  onHandlePointerDown={(handle, e) =>
                    beginTransform(
                      handle,
                      { kind: "section", id: section.id },
                      section.x,
                      section.y,
                      e,
                      cx,
                      cy,
                      handleAngle
                    )
                  }
                />
              )}
              {designerMode && !isSelected && (
                <rect
                  x={hitX}
                  y={hitY}
                  width={bounds.w}
                  height={bounds.h}
                  rx={section.kind === "TABLE" ? 12 : 6}
                  fill="transparent"
                  stroke="#64748b"
                  strokeWidth={1}
                  strokeDasharray={section.enabled ? "4 3" : "4 3"}
                  className="cursor-pointer"
                  onClick={() => handleSectionClick(section.id)}
                />
              )}
            </g>
          );
        })}
      </svg>
    </>
  );

  if (embedded) {
    return <div className={cn("w-full min-w-0 max-w-full", className)}>{mapBody}</div>;
  }

  return (
    <div className={cn("overflow-auto rounded-xl border bg-muted/20 p-2", className)}>
      {mapBody}
    </div>
  );
}

export function SeatLegend({
  layout,
  counts,
  onlyConfigured,
}: {
  layout: SeatLayoutDocument;
  counts?: Record<string, { available: number; total: number }>;
  /** When true (default if counts provided), hide tiers with no seats on the map. */
  onlyConfigured?: boolean;
}) {
  const hideUnconfigured = onlyConfigured ?? Boolean(counts);

  return (
    <ul className="flex flex-wrap gap-3 text-xs">
      {layout.categories
        .filter((c) => {
          if (!c.enabled) return false;
          if (!hideUnconfigured || !counts) return true;
          return (counts[c.id]?.total ?? 0) > 0;
        })
        .map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: c.color }} />
            <span className="font-medium">{c.name}</span>
            <span className="tabular-nums text-muted-foreground">{formatCurrency(c.price / 100)}</span>
            {counts?.[c.id] && (
              <span className="text-muted-foreground">
                ({counts[c.id].available}/{counts[c.id].total})
              </span>
            )}
          </li>
        ))}
      <li className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-sm ring-1 ring-black/10"
          style={{ backgroundColor: SEAT_SELECTED_FILL }}
        />
        <span className="font-medium">Your selection</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: SEAT_HELD_FILL }} />
        <span>Held by another buyer</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: SEAT_BOOKED_FILL }} />
        <span className="font-medium">Booked</span>
      </li>
    </ul>
  );
}
