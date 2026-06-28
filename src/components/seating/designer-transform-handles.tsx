"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TransformHandle =
  | "move"
  | "resize-nw"
  | "resize-ne"
  | "resize-se"
  | "resize-sw"
  | "rotate";

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotateDeg?: number;
  selected: boolean;
  onHandlePointerDown: (handle: TransformHandle, e: React.PointerEvent) => void;
  showAngle?: boolean;
};

const HANDLE = 8;
const ROTATE_OFFSET = 28;

export function DesignerTransformHandles({
  x,
  y,
  width,
  height,
  rotateDeg = 0,
  selected,
  onHandlePointerDown,
  showAngle = true,
}: Props) {
  if (!selected) return null;

  const cx = x + width / 2;
  const cy = y + height / 2;
  const corners = [
    { id: "resize-nw" as const, hx: x, hy: y, cursor: "nwse-resize" },
    { id: "resize-ne" as const, hx: x + width, hy: y, cursor: "nesw-resize" },
    { id: "resize-se" as const, hx: x + width, hy: y + height, cursor: "nwse-resize" },
    { id: "resize-sw" as const, hx: x, hy: y + height, cursor: "nesw-resize" },
  ];

  return (
    <g
      className="pointer-events-none"
      transform={`rotate(${rotateDeg}, ${cx}, ${cy})`}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="rgba(124, 58, 237, 0.05)"
        stroke="#7c3aed"
        strokeWidth={2}
        rx={6}
        className="pointer-events-auto cursor-move"
        onPointerDown={(e) => {
          e.stopPropagation();
          onHandlePointerDown("move", e);
        }}
      />
      {corners.map((c) => (
        <rect
          key={c.id}
          x={c.hx - HANDLE / 2}
          y={c.hy - HANDLE / 2}
          width={HANDLE}
          height={HANDLE}
          rx={2}
          fill="#7c3aed"
          stroke="#fff"
          strokeWidth={1.5}
          className={cn("pointer-events-auto", c.cursor)}
          style={{ cursor: c.cursor }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onHandlePointerDown(c.id, e);
          }}
        />
      ))}
      {showAngle && (
        <g className="pointer-events-auto">
          <line
            x1={cx}
            y1={y}
            x2={cx}
            y2={y - ROTATE_OFFSET + HANDLE / 2}
            stroke="#7c3aed"
            strokeWidth={1.5}
            className="pointer-events-none"
          />
          <circle
            cx={cx}
            cy={y - ROTATE_OFFSET}
            r={10}
            fill="#7c3aed"
            stroke="#fff"
            strokeWidth={1.5}
            className="cursor-grab"
            onPointerDown={(e) => {
              e.stopPropagation();
              onHandlePointerDown("rotate", e);
            }}
          />
          <g
            transform={`translate(${cx}, ${y - ROTATE_OFFSET})`}
            className="pointer-events-none"
          >
            <path
              d="M -4 -2 A 4 4 0 1 1 2 -4"
              fill="none"
              stroke="#fff"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <path
              d="M 2 -4 L 4 -1 L 1 -2"
              fill="none"
              stroke="#fff"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <text
            x={cx + 14}
            y={y - ROTATE_OFFSET + 4}
            className="fill-violet-400 text-[9px] font-semibold"
          >
            {Math.round(((rotateDeg % 360) + 360) % 360)}°
          </text>
        </g>
      )}
    </g>
  );
}

export function Round360Guides({
  cx,
  cy,
  innerR,
  outerR,
}: {
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
}) {
  const radials = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g className="pointer-events-none" opacity={0.35}>
      {[innerR, (innerR + outerR) / 2, outerR].map((r) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#64748b"
          strokeWidth={1}
          strokeDasharray="6 6"
        />
      ))}
      {radials.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x2 = cx + outerR * Math.sin(rad);
        const y2 = cy + outerR * Math.cos(rad);
        return (
          <line
            key={deg}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke="#64748b"
            strokeWidth={1}
            strokeDasharray="4 5"
          />
        );
      })}
    </g>
  );
}
