"use client";

import * as React from "react";
import {
  Circle,
  Grid3X3,
  MapPin,
  Move,
  Monitor,
  Plus,
  Square,
  Trash2,
  Type,
  Users,
  MousePointer2,
  RotateCw,
  Undo2,
  Redo2,
  Eraser,
  RotateCcw,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  enumerateSectionSeats,
  newLayoutId,
  getSectionBounds,
  suggestSectionPlacementInZone,
  suggestVenueZonePlacement,
} from "@/lib/seating/layout-utils";
import { seatLabelFromIndices } from "@/lib/seating/naming";
import {
  TABLE_PACK_SIZES,
  createTableSection,
  getTablePackSize,
  getTableSideMode,
  tableDescriptor,
  tablePackLabel,
  tableSideLabel,
} from "@/lib/seating/table-pack";
import type {
  LayoutCategory,
  LayoutLandmark,
  LayoutOrientation,
  LayoutSection,
  LayoutVenueZone,
  NamingScheme,
  RowNamingScheme,
  ColNamingScheme,
  SeatLayoutDocument,
  TablePackSize,
  TableSideMode,
  VenueZoneKind,
} from "@/lib/seating/types";
import { countLayoutSeats, computeLayoutExtents } from "@/lib/seating/layout-utils";
import { nextCategoryColor } from "@/lib/seating/seat-colors";
import type { EventTicketPackage } from "@/lib/seating/package-sync";
import {
  TICKET_KIND_LABELS,
  getCategoryCapacityList,
  validateLayoutSeatCapacities,
  countSectionSeats,
} from "@/lib/seating/package-sync";
import {
  getVenueZones,
  venueZoneKindLabel,
  getChildZones,
  zoneDisplayName,
  DESIGNER_ZONE_TOOLS,
  nextZoneName,
  type DesignerZonePreset,
} from "@/lib/seating/venue-zones";
import { LAYOUT_WIZARDS } from "@/lib/seating/layout-builders";
import { VENUE_PRESETS, type VenuePresetDef } from "@/lib/seating/venue-presets";
import { parseRowColCounts, formatRowColCounts } from "@/lib/seating/section-helpers";
import type { SeatShape } from "@/lib/seating/types";
import {
  isRingCurvedSection,
  moveRingSectionPolar,
  snapSectionToZone,
  syncSectionsInZone,
  sectionsInZone,
  createRingSectionForZone,
  sectionGeometryFromZone,
} from "@/lib/seating/ring-section-sync";
import { isWedgeZone, isInTheRound, suggestStandingZone, isStandingZone } from "@/lib/seating/round-zones";
import {
  defaultRowLayoutForOrientation,
  orientationSpanDegrees,
  resolveRowLayout,
  rowLayoutLabel,
} from "@/lib/seating/row-layout";
import type { SeatRowLayout } from "@/lib/seating/types";
import { SeatMapViewport } from "./seat-map-viewport";
import { SeatLayoutPreview, SeatLegend } from "./seat-layout-preview";
import {
  DesignerMobileToggles,
  DesignerToolGroup,
  SeatDesignerWorkspace,
  type DesignerToolsTab,
} from "./seat-designer-workspace";
import { cn } from "@/lib/utils";
import {
  commitLayoutHistory,
  createLayoutHistory,
  redoLayoutHistory,
  undoLayoutHistory,
  type LayoutHistoryState,
} from "@/lib/seating/layout-history";

type SelectTarget =
  | { kind: "section"; id: string }
  | { kind: "landmark"; id: string }
  | { kind: "zone"; id: string }
  | { kind: "none" };

const ORIENTATIONS: { value: LayoutOrientation; label: string; hint: string; rowLayout: SeatRowLayout }[] = [
  { value: "FRONT", label: "Front", hint: "Straight seat rows - audience faces stage", rowLayout: "STRAIGHT" },
  { value: "360", label: "360°", hint: "In the round - curved rows around centre stage", rowLayout: "CURVED" },
];

function isOrientationActive(current: LayoutOrientation, option: LayoutOrientation): boolean {
  if (option === "FRONT") return current === "FRONT";
  return current !== "FRONT";
}

const ROW_LAYOUT_OPTIONS: { value: SeatRowLayout; label: string }[] = [
  { value: "AUTO", label: "Auto (follow audience view)" },
  { value: "STRAIGHT", label: "Straight rows" },
  { value: "CURVED", label: "Curved rows" },
];

const RING_SEAT_PRESETS: { label: string; rows: number; cols: number; hint: string }[] = [
  { label: "Ring row", rows: 2, cols: 10, hint: "Short curved row around stage" },
  { label: "Ring block", rows: 4, cols: 12, hint: "Curved block for in-the-round" },
  { label: "Outer ring", rows: 6, cols: 16, hint: "Wider arc section" },
];

const ROW_SCHEMES: { value: RowNamingScheme; label: string }[] = [
  { value: "LETTERS", label: "A, B, C…" },
  { value: "NUMBERS", label: "1, 2, 3…" },
  { value: "LETTERS_REVERSE", label: "Z, Y, X…" },
];

const COL_SCHEMES: { value: ColNamingScheme; label: string }[] = [
  { value: "NUMBERS", label: "1, 2, 3…" },
  { value: "LETTERS", label: "A, B, C…" },
];

const NORMAL_SEAT_PRESETS: { label: string; rows: number; cols: number; hint: string }[] = [
  { label: "Single row", rows: 1, cols: 20, hint: "One straight row - theatre / arena" },
  { label: "Small block", rows: 6, cols: 12, hint: "72 seats" },
  { label: "Medium block", rows: 12, cols: 25, hint: "300 seats" },
  { label: "Large block", rows: 25, cols: 50, hint: "1,250 seats" },
  { label: "Arena block", rows: 50, cols: 100, hint: "5,000 seats - use zoom to navigate" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

function NumInput({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8"
      />
    </label>
  );
}

type Props = {
  layout: SeatLayoutDocument;
  onChange: (layout: SeatLayoutDocument) => void;
  ticketPackages?: EventTicketPackage[];
};

export function SeatLayoutDesigner({ layout, onChange, ticketPackages }: Props) {
  const { toast } = useToast();
  const [selection, setSelection] = React.useState<SelectTarget>({ kind: "none" });
  const [showNaming, setShowNaming] = React.useState(false);
  const resetSnapshotRef = React.useRef(layout);
  const [history, setHistory] = React.useState<LayoutHistoryState>(() =>
    createLayoutHistory(layout)
  );

  const [tableSideMode, setTableSideMode] = React.useState<TableSideMode>("TWO");
  const [groupSelectMode, setGroupSelectMode] = React.useState(false);
  const [groupedSeatKeys, setGroupedSeatKeys] = React.useState<Set<string>>(new Set());
  const [toolsTab, setToolsTab] = React.useState<DesignerToolsTab>("zones");
  const [mobileToolsOpen, setMobileToolsOpen] = React.useState(false);
  const [mobilePropsOpen, setMobilePropsOpen] = React.useState(false);

  const selectionRef = React.useRef(selection);
  const layoutRef = React.useRef(layout);
  selectionRef.current = selection;
  layoutRef.current = layout;

  const venueZones = getVenueZones(layout);
  const hasVenueZones = venueZones.length > 0;
  const roundMode = isInTheRound(layout);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const commitChange = React.useCallback(
    (next: SeatLayoutDocument) => {
      setHistory((h) => commitLayoutHistory(h, next));
      onChange(next);
    },
    [onChange]
  );

  const capacityByCategory = React.useMemo(
    () => (ticketPackages?.length ? getCategoryCapacityList(ticketPackages, layout) : []),
    [ticketPackages, layout]
  );

  const tryCommitLayout = React.useCallback(
    (next: SeatLayoutDocument) => {
      if (ticketPackages?.length) {
        const v = validateLayoutSeatCapacities(ticketPackages, next);
        if (!v.ok) {
          toast({
            title: "Exceeds ticket quantity",
            description: v.message,
            variant: "destructive",
          });
          return false;
        }
      }
      commitChange(next);
      return true;
    },
    [ticketPackages, commitChange, toast]
  );

  const patch = (partial: Partial<SeatLayoutDocument>) => {
    tryCommitLayout({ ...layout, ...partial });
  };

  const undo = () => {
    setHistory((h) => {
      const next = undoLayoutHistory(h);
      if (next) {
        onChange(next.present);
        return next;
      }
      return h;
    });
  };

  const redo = () => {
    setHistory((h) => {
      const next = redoLayoutHistory(h);
      if (next) {
        onChange(next.present);
        return next;
      }
      return h;
    });
  };

  const resetLayout = () => {
    commitChange(resetSnapshotRef.current);
    setSelection({ kind: "none" });
    setGroupedSeatKeys(new Set());
    toast({ title: "Layout reset", description: "Restored to last saved snapshot." });
  };

  const clearSurface = () => {
    commitChange({ ...layout, zones: [], sections: [] });
    setSelection({ kind: "none" });
    setGroupedSeatKeys(new Set());
    toast({ title: "Surface cleared", description: "All zones and seat blocks removed. Stage kept." });
  };

  const defaultCategoryId = layout.categories[0]?.id ?? "cat-standard";

  const pickCategoryForSeats = (seatCount: number, excludeStanding = true): string => {
    if (!ticketPackages?.length) return defaultCategoryId;
    for (const cap of capacityByCategory) {
      const pkg = ticketPackages.find((p) => p.id === cap.categoryId);
      if (excludeStanding && pkg?.ticketKind === "STANDING") continue;
      if (cap.remaining >= seatCount) return cap.categoryId;
    }
    for (const cap of capacityByCategory) {
      const pkg = ticketPackages.find((p) => p.id === cap.categoryId);
      if (excludeStanding && pkg?.ticketKind === "STANDING") continue;
      if (cap.remaining > 0) return cap.categoryId;
    }
    return defaultCategoryId;
  };

  const categoryRemainingForSection = (
    categoryId: string,
    section?: LayoutSection
  ): number => {
    const cap = capacityByCategory.find((c) => c.categoryId === categoryId);
    if (!cap) return Infinity;
    const inSection =
      section && section.categoryId === categoryId
        ? countSectionSeats(section, layout)
        : 0;
    return cap.remaining + inSection;
  };

  const activeZoneId = React.useMemo(() => {
    if (selection.kind === "zone") return selection.id;
    if (selection.kind === "section") {
      const sec = layout.sections.find((s) => s.id === selection.id);
      if (sec?.zoneId) return sec.zoneId;
    }
    return venueZones[0]?.id ?? null;
  }, [selection, layout.sections, venueZones]);

  const requireVenueZone = () => {
    if (hasVenueZones) return true;
    toast({
      title: roundMode ? "Divide the ring first" : "Divide the venue first",
      description: "Add venue areas in the Zones tab before placing seats or tables.",
      variant: "destructive",
    });
    return false;
  };

  const addStandingArea = (capacity = 300) => {
    const id = newLayoutId("stand");
    const baseName = "Standing area";
    const draft = suggestStandingZone(layout, capacity);
    const zone: LayoutVenueZone = {
      id,
      name: nextZoneName(venueZones, baseName),
      sortOrder: venueZones.length,
      categoryId: defaultCategoryId,
      ...draft,
    };
    patch({ zones: [...venueZones, zone] });
    setSelection({ kind: "zone", id });
    toast({
      title: "Standing area added",
      description: `${capacity.toLocaleString()} capacity - no individual seats. Assign a pricing tier in Properties.`,
    });
  };

  const toggleSeatGroup = (sectionId: string, seatId: string) => {
    const key = `${sectionId}:${seatId}`;
    setGroupedSeatKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const assignGroupedSeats = (categoryId: string) => {
    const bySection = new Map<string, string[]>();
    for (const key of groupedSeatKeys) {
      const [secId, seatId] = key.split(":");
      if (!secId || !seatId) continue;
      const list = bySection.get(secId) ?? [];
      list.push(seatId);
      bySection.set(secId, list);
    }
    patch({
      sections: layout.sections.map((sec) => {
        const ids = bySection.get(sec.id);
        if (!ids?.length) return sec;
        const enumerated = enumerateSectionSeats(sec, layout);
        const overrides = [...(sec.seats ?? [])];
        for (const seatId of ids) {
          const seat = enumerated.find((s) => s.id === seatId);
          if (!seat) continue;
          const idx = overrides.findIndex(
            (o) => o.rowIndex === seat.rowIndex && o.colIndex === seat.colIndex
          );
          if (idx >= 0) overrides[idx] = { ...overrides[idx]!, categoryId };
          else
            overrides.push({
              id: seatId,
              rowIndex: seat.rowIndex,
              colIndex: seat.colIndex,
              categoryId,
              enabled: true,
            });
        }
        return { ...sec, seats: overrides };
      }),
    });
    setGroupedSeatKeys(new Set());
    toast({ title: "Seat group assigned to pricing tier" });
  };

  const addVenueZone = (preset: DesignerZonePreset) => {
    const id = newLayoutId("area");
    const name = nextZoneName(venueZones, preset.name);
    const { x, y } = suggestVenueZonePlacement(layout, preset.width, preset.height);
    const zone: LayoutVenueZone = {
      id,
      name,
      kind: preset.kind,
      x,
      y,
      width: preset.width,
      height: preset.height,
      sortOrder: venueZones.length,
    };
    patch({ zones: [...venueZones, zone] });
    setSelection({ kind: "zone", id });
  };

  const updateZone = (id: string, data: Partial<LayoutVenueZone>) => {
    const nextZones = venueZones.map((z) => (z.id === id ? { ...z, ...data } : z));
    const updated = nextZones.find((z) => z.id === id);
    const wedgeKeys = [
      "wedgeStartDeg",
      "wedgeEndDeg",
      "innerRadius",
      "outerRadius",
    ] as const;
    const shouldSync =
      updated &&
      isWedgeZone(updated) &&
      wedgeKeys.some((k) => k in data);

    patch({
      zones: nextZones,
      sections: shouldSync ? syncSectionsInZone({ ...layout, zones: nextZones }, id) : layout.sections,
    });
  };

  const removeZone = (id: string) => {
    const toRemove = new Set<string>([id]);
    let growing = true;
    while (growing) {
      growing = false;
      for (const z of venueZones) {
        if (z.parentZoneId && toRemove.has(z.parentZoneId) && !toRemove.has(z.id)) {
          toRemove.add(z.id);
          growing = true;
        }
      }
    }
    patch({
      zones: venueZones.filter((z) => !toRemove.has(z.id)),
      sections: layout.sections.map((s) =>
        s.zoneId && toRemove.has(s.zoneId) ? { ...s, zoneId: undefined } : s
      ),
    });
    if (selection.kind === "zone" && toRemove.has(selection.id)) {
      setSelection({ kind: "none" });
    }
  };

  const patchRef = React.useRef(patch);
  const undoRef = React.useRef(undo);
  const redoRef = React.useRef(redo);
  const removeZoneRef = React.useRef(removeZone);
  patchRef.current = patch;
  undoRef.current = undo;
  redoRef.current = redo;
  removeZoneRef.current = removeZone;

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const currentSelection = selectionRef.current;
      const currentLayout = layoutRef.current;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (currentSelection.kind !== "none") {
          e.preventDefault();
          if (currentSelection.kind === "section") {
            patchRef.current({
              sections: currentLayout.sections.filter((s) => s.id !== currentSelection.id),
            });
          } else if (currentSelection.kind === "landmark") {
            patchRef.current({
              landmarks: currentLayout.landmarks.filter((l) => l.id !== currentSelection.id),
            });
          } else if (currentSelection.kind === "zone") {
            removeZoneRef.current(currentSelection.id);
            return;
          }
          setSelection({ kind: "none" });
        }
      }
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
      }
      if (e.ctrlKey && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const applyLayoutWizard = (wizard: (typeof LAYOUT_WIZARDS)[number]) => {
    const next = wizard.build();
    commitChange(next);
    setSelection({ kind: "none" });
    setGroupedSeatKeys(new Set());
    setGroupSelectMode(false);
    resetSnapshotRef.current = next;
    toast({
      title: `${wizard.label} applied`,
      description: wizard.hint,
    });
  };

  const applyVenuePreset = (preset: VenuePresetDef) => {
    if (!preset.available || !preset.build) {
      toast({
        title: "Coming soon",
        description: `${preset.label} layout is not available yet.`,
      });
      return;
    }
    const next = preset.build();
    commitChange(next);
    setSelection({ kind: "none" });
    setGroupedSeatKeys(new Set());
    setGroupSelectMode(false);
    resetSnapshotRef.current = next;
    toast({
      title: `${preset.label} applied`,
      description: preset.hint,
    });
  };

  const addSubZone = () => {
    const parent =
      selection.kind === "zone"
        ? venueZones.find((z) => z.id === selection.id)
        : venueZones.find((z) => z.id === activeZoneId);
    if (!parent || parent.shape === "WEDGE" || isStandingZone(parent)) {
      toast({
        title: "Select a parent area",
        description: "Sub-zones nest inside ground floor, zone, section, balcony, or custom areas.",
        variant: "destructive",
      });
      return;
    }
    const id = newLayoutId("zone");
    const siblings = getChildZones({ zones: venueZones }, parent.id);
    const zone: LayoutVenueZone = {
      id,
      name: nextZoneName(venueZones, "Sub-zone"),
      kind: "CUSTOM",
      parentZoneId: parent.id,
      x: parent.x + 16,
      y: parent.y + 40 + siblings.length * 12,
      width: Math.max(140, parent.width - 32),
      height: Math.max(100, Math.floor((parent.height - 56) / Math.max(1, siblings.length + 1))),
      sortOrder: venueZones.length,
    };
    patch({ zones: [...venueZones, zone] });
    setSelection({ kind: "zone", id });
  };

  const addCategory = () => {
    const id = newLayoutId("cat");
    const cat: LayoutCategory = {
      id,
      name: `Tier ${layout.categories.length + 1}`,
      color: nextCategoryColor(layout.categories),
      price: 250000,
      enabled: true,
      sortOrder: layout.categories.length,
    };
    patch({ categories: [...layout.categories, cat] });
  };

  const updateCategory = (id: string, data: Partial<LayoutCategory>) => {
    patch({
      categories: layout.categories.map((c) => (c.id === id ? { ...c, ...data } : c)),
    });
  };

  const removeCategory = (id: string) => {
    if (layout.categories.length <= 1) return;
    patch({
      categories: layout.categories.filter((c) => c.id !== id),
      sections: layout.sections.map((s) =>
        s.categoryId === id ? { ...s, categoryId: layout.categories.find((c) => c.id !== id)!.id } : s
      ),
    });
  };

  const addGridSection = (rows = 4, cols = 10) => {
    if (!requireVenueZone()) return;
    const activeZone = venueZones.find((z) => z.id === activeZoneId);
    if (activeZone && isStandingZone(activeZone)) {
      toast({
        title: "Select a seated ring section",
        description: "Standing areas have no seats - pick a ring wedge or hall area for seat blocks.",
        variant: "destructive",
      });
      return;
    }
    const id = newLayoutId("sec");
    const n = layout.sections.filter((s) => s.kind === "GRID").length;
    const gridSeatCount = rows * cols;
    const blockCategoryId = pickCategoryForSeats(gridSeatCount);
    if (ticketPackages?.length) {
      const cap = capacityByCategory.find((c) => c.categoryId === blockCategoryId);
      if (cap && gridSeatCount > cap.remaining) {
        toast({
          title: "Not enough tickets for this block",
          description: `"${cap.name}" has ${cap.remaining} ticket(s) left (${cap.mapped}/${cap.qtyTotal} placed). Use fewer rows/columns or increase quantity on the event page.`,
          variant: "destructive",
        });
        return;
      }
    }
    const bounds = getSectionBounds({
      id,
      name: "",
      enabled: true,
      kind: "GRID",
      categoryId: blockCategoryId,
      zoneId: activeZoneId ?? undefined,
      x: 0,
      y: 0,
      rows,
      cols,
      rowGap: 4,
      colGap: 4,
      seatWidth: 22,
      seatHeight: 22,
    });
    const { x, y } = suggestSectionPlacementInZone(layout, bounds, activeZoneId);
    const zoneName = activeZone?.name;
    let section: LayoutSection = {
      id,
      name: rows === 1 ? `Row ${n + 1}` : `Section ${n + 1}`,
      enabled: true,
      kind: "GRID",
      categoryId: blockCategoryId,
      zoneId: activeZoneId ?? undefined,
      rowLayout: "AUTO",
      x,
      y,
      rows,
      cols,
      rowGap: 4,
      colGap: 4,
      seatWidth: 22,
      seatHeight: 22,
      seatShape: roundMode ? "ROUND" : undefined,
    };

    if (activeZone && isWedgeZone(activeZone) && !isStandingZone(activeZone)) {
      section = snapSectionToZone(
        {
          ...section,
          rowLayout: "CURVED",
          rowColCounts: rows >= 3 ? Array.from({ length: rows }, (_, i) => cols + i * 2) : undefined,
          name: `${activeZone.name} seats`,
        },
        activeZone,
        layout
      );
    }

    patch({ sections: [...layout.sections, section] });
    setSelection({ kind: "section", id });
    if (zoneName) {
      toast({
        title: `Added to ${zoneName}`,
        description: isWedgeZone(activeZone!)
          ? "Seats aligned to this ring wedge - drag to move along the arc."
          : "Drag the block to fine-tune position inside the area.",
      });
    }
  };

  const addSeatsInWedgeZone = (zoneId: string) => {
    const zone = venueZones.find((z) => z.id === zoneId);
    if (!zone || !isWedgeZone(zone) || isStandingZone(zone)) return;
    const existing = sectionsInZone(layout, zoneId);
    if (existing.length > 0) {
      patch({ sections: syncSectionsInZone(layout, zoneId) });
      setSelection({ kind: "section", id: existing[0]!.id });
      toast({ title: "Seats synced to wedge", description: "Re-aligned to zone arc and radius." });
      return;
    }
    const section = createRingSectionForZone(zone, layout, { name: `${zone.name} seats` });
    section.id = newLayoutId("sec");
    patch({ sections: [...layout.sections, section] });
    setSelection({ kind: "section", id: section.id });
    toast({ title: "Ring seats added", description: "Curved rows placed inside the selected wedge." });
  };

  const snapSelectedSectionToZone = () => {
    if (selection.kind !== "section") return;
    const sec = layout.sections.find((s) => s.id === selection.id);
    const zone = sec?.zoneId ? venueZones.find((z) => z.id === sec.zoneId) : undefined;
    if (!sec || !zone || !isWedgeZone(zone)) {
      toast({
        title: "Select a section in a ring wedge",
        description: "Assign a ring zone first, then snap.",
        variant: "destructive",
      });
      return;
    }
    updateSection(sec.id, sectionGeometryFromZone(sec, zone, layout));
    toast({ title: "Snapped to zone arc" });
  };

  const addTablePack = (pack: TablePackSize) => {
    if (!requireVenueZone()) return;
    const id = newLayoutId("tbl");
    const n = layout.sections.filter((s) => s.kind === "TABLE").length;
    const draft = createTableSection(
      id,
      `Table ${n + 1}`,
      pack,
      defaultCategoryId,
      0,
      0,
      tableSideMode
    );
    draft.zoneId = activeZoneId ?? undefined;
    const { x, y } = suggestSectionPlacementInZone(layout, getSectionBounds(draft), activeZoneId);
    const section = { ...draft, x, y };
    patch({ sections: [...layout.sections, section] });
    setSelection({ kind: "section", id });
  };

  const stripTableName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim();

  const setTablePackSize = (sectionId: string, pack: TablePackSize) => {
    const sec = layout.sections.find((s) => s.id === sectionId);
    if (!sec || sec.kind !== "TABLE") return;
    const baseName = stripTableName(sec.name);
    updateSection(sectionId, {
      tablePackSize: pack,
      cols: pack,
      name: `${baseName} (${tablePackLabel(pack)}, ${tableSideLabel(getTableSideMode(sec))})`,
    });
  };

  const setTableSides = (sectionId: string, mode: TableSideMode) => {
    const sec = layout.sections.find((s) => s.id === sectionId);
    if (!sec || sec.kind !== "TABLE") return;
    const baseName = stripTableName(sec.name);
    updateSection(sectionId, {
      tableSideMode: mode,
      name: `${baseName} (${tablePackLabel(getTablePackSize(sec))}, ${tableSideLabel(mode)})`,
    });
  };

  const addLandmark = (type: LayoutLandmark["type"]) => {
    const id = newLayoutId("lm");
    const cx = layout.viewBox.width / 2;
    const lm: LayoutLandmark =
      type === "STAGE_ROUND"
        ? {
            id,
            type,
            label: "Stage (360°)",
            x: cx,
            y: layout.viewBox.height / 2,
            radius: 80,
          }
        : type === "SCREEN"
          ? {
              id,
              type,
              label: "Screen",
              x: cx - 160,
              y: layout.orientation === "360" ? 40 : 120,
              width: 320,
              height: 12,
            }
          : {
              id,
              type: "STAGE_BOX",
              label: "Stage",
              x: cx - 200,
              y: layout.orientation === "360" ? cyCentre(layout) - 200 : 40,
              width: 400,
              height: 80,
            };
    patch({ landmarks: [...layout.landmarks, lm] });
    setSelection({ kind: "landmark", id });
  };

  function cyCentre(doc: SeatLayoutDocument) {
    return doc.viewBox.height / 2;
  }

  const applyOrientation = (orientation: LayoutOrientation) => {
    let landmarks = layout.landmarks;
    if (orientation === "360" && !landmarks.some((l) => l.type === "STAGE_ROUND")) {
      const cx = layout.viewBox.width / 2;
      const cy = layout.viewBox.height / 2;
      landmarks = [
        ...landmarks.filter((l) => l.type !== "STAGE_BOX"),
        {
          id: newLayoutId("lm"),
          type: "STAGE_ROUND" as const,
          label: "Stage (360°)",
          x: cx,
          y: cy,
          radius: 90,
        },
      ];
    }
    patch({
      orientation,
      landmarks,
      sections: layout.sections.map((s) =>
        s.kind === "GRID" && (s.rowLayout == null || s.rowLayout === "AUTO")
          ? { ...s, rowLayout: "AUTO" as const, curveSpanDeg: undefined }
          : s
      ),
    });
    toast({
      title: orientation === "FRONT" ? "Straight row layout" : orientation === "360" ? "In-the-round layout" : "Curved row layout",
      description:
        orientation === "360"
          ? "Use ring wedges + standing areas (Step 1), then curved seat blocks. Group seats by selection to assign tiers."
          : orientation === "FRONT"
            ? "Seat blocks use straight rows. Override per block in Properties if needed."
            : `${orientationSpanDegrees(orientation)}° fan - curved rows facing the stage.`,
    });
  };

  const updateSection = (id: string, data: Partial<LayoutSection>) => {
    patch({
      sections: layout.sections.map((s) => (s.id === id ? { ...s, ...data } : s)),
    });
  };

  const updateLandmark = (id: string, data: Partial<LayoutLandmark>) => {
    patch({
      landmarks: layout.landmarks.map((l) => (l.id === id ? { ...l, ...data } : l)),
    });
  };

  const deleteSelected = () => {
    if (selection.kind === "section") {
      patch({ sections: layout.sections.filter((s) => s.id !== selection.id) });
    } else if (selection.kind === "landmark") {
      patch({ landmarks: layout.landmarks.filter((l) => l.id !== selection.id) });
    } else if (selection.kind === "zone") {
      removeZone(selection.id);
      return;
    }
    setSelection({ kind: "none" });
  };

  const updateNaming = (partial: Partial<NamingScheme>) => {
    patch({ naming: { ...layout.naming, ...partial } });
  };

  const selectedSection =
    selection.kind === "section"
      ? layout.sections.find((s) => s.id === selection.id)
      : undefined;
  const selectedLandmark =
    selection.kind === "landmark"
      ? layout.landmarks.find((l) => l.id === selection.id)
      : undefined;
  const selectedZone =
    selection.kind === "zone" ? venueZones.find((z) => z.id === selection.id) : undefined;

  const sampleLabels = selectedSection
    ? enumerateSectionSeats(selectedSection, layout)
        .slice(0, 6)
        .map((s) => s.label)
        .join(", ")
    : null;

  const seatTotal = countLayoutSeats(layout);
  const layoutExtents = React.useMemo(() => computeLayoutExtents(layout), [layout]);

  return (
    <SeatDesignerWorkspace
      toolsTab={toolsTab}
      onToolsTabChange={(tab) => {
        setToolsTab(tab);
        setMobileToolsOpen(false);
      }}
      mobileToolsOpen={mobileToolsOpen}
      onMobileToolsOpenChange={setMobileToolsOpen}
      mobilePropsOpen={mobilePropsOpen}
      onMobilePropsOpenChange={setMobilePropsOpen}
      commandBar={
        <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={!canUndo}
            onClick={undo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={!canRedo}
            onClick={redo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="mx-0.5 hidden h-6 sm:block" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={resetLayout}
            title="Reset to last saved snapshot"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={clearSurface}
            title="Remove all zones and seats"
          >
            <Eraser className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
          <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex">
            {ORIENTATIONS.map((o) => (
              <Button
                key={o.value}
                type="button"
                size="sm"
                variant={isOrientationActive(layout.orientation, o.value) ? "default" : "ghost"}
                className="h-7 shrink-0 px-2 text-[11px]"
                title={o.hint}
                onClick={() => applyOrientation(o.value)}
              >
                {o.label}
              </Button>
            ))}
          </div>
          <DesignerMobileToggles
            onOpenTools={() => setMobileToolsOpen(true)}
            onOpenProperties={() => setMobilePropsOpen(true)}
          />
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] font-normal">
              {seatTotal} seats
            </Badge>
            {hasVenueZones && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                {venueZones.length} zone{venueZones.length === 1 ? "" : "s"}
              </Badge>
            )}
            {roundMode && (
              <Badge variant="outline" className="text-[10px] font-normal">
                360°
              </Badge>
            )}
          </div>
        </div>
      }
      toolsPanel={
        <div className="space-y-3">
          {toolsTab === "setup" && (
            <>
              <DesignerToolGroup
                title="Venue presets"
                hint="Named halls and theatres. Starter layouts - swap in your detailed plans in venue-presets.ts when ready."
              >
                {VENUE_PRESETS.map((preset) => (
                  <Button
                    key={preset.slug}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-8 w-full justify-start gap-2 px-2 py-1.5 text-xs"
                    title={preset.hint}
                    disabled={!preset.available}
                    onClick={() => applyVenuePreset(preset)}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                      <span className="flex w-full items-center gap-1.5">
                        {preset.label}
                        {!preset.available && (
                          <Badge variant="outline" className="px-1 py-0 text-[9px] font-normal">
                            Soon
                          </Badge>
                        )}
                      </span>
                      {preset.location && (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {preset.location}
                        </span>
                      )}
                    </span>
                  </Button>
                ))}
              </DesignerToolGroup>

              <DesignerToolGroup
                title="Quick start layouts"
                hint="Generic theatre and 360° patterns - fully editable after apply."
              >
                {LAYOUT_WIZARDS.map((wizard) => (
                  <Button
                    key={wizard.slug}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full justify-start gap-2 px-2 text-xs"
                    title={wizard.hint}
                    onClick={() => applyLayoutWizard(wizard)}
                  >
                    {wizard.label}
                  </Button>
                ))}
              </DesignerToolGroup>
              <p className="text-[10px] text-muted-foreground">
                Tip: use Zones next to divide the venue, then Seats to fill each area.
              </p>
            </>
          )}

          {toolsTab === "zones" && (
            <>
              <div className="flex items-center gap-2">
                <Badge variant={hasVenueZones ? "secondary" : "default"} className="text-[10px]">
                  Step 1
                </Badge>
                <p className="text-xs font-semibold">Venue areas</p>
                {roundMode && (
                  <Badge variant="outline" className="text-[10px]">
                    360°
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Divide the venue into floors, zones, and sections before adding seats.
              </p>
              <DesignerToolGroup title="Add area">
                {DESIGNER_ZONE_TOOLS.map((tool) => {
                  if (tool.type === "preset") {
                    return (
                      <Button
                        key={tool.preset.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full justify-start gap-2 px-2 text-xs"
                        title={tool.preset.hint}
                        onClick={() => addVenueZone(tool.preset)}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {tool.preset.label}
                      </Button>
                    );
                  }
                  if (tool.type === "sub-zone") {
                    return (
                      <Button
                        key="sub-zone"
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full justify-start gap-2 px-2 text-xs"
                        title={tool.hint}
                        onClick={addSubZone}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {tool.label}
                      </Button>
                    );
                  }
                  return (
                    <Button
                      key="standing"
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full justify-start gap-2 px-2 text-xs"
                      title={tool.hint}
                      onClick={() => addStandingArea(tool.capacity)}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      {tool.label}
                    </Button>
                  );
                })}
              </DesignerToolGroup>
              {hasVenueZones && (
                <p className="text-[10px] text-muted-foreground">
                  {venueZones.length} area{venueZones.length === 1 ? "" : "s"} - select on canvas, then
                  switch to Seats.
                </p>
              )}
            </>
          )}

          {toolsTab === "seats" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={hasVenueZones ? "default" : "outline"} className="text-[10px]">
                  Step 2
                </Badge>
                <p
                  className={cn(
                    "text-xs font-semibold",
                    !hasVenueZones && "text-muted-foreground"
                  )}
                >
                  Seats & tables
                </p>
                {activeZoneId && hasVenueZones && (
                  <span className="text-[10px] text-muted-foreground">
                    → {venueZones.find((z) => z.id === activeZoneId)?.name}
                  </span>
                )}
              </div>
              <DesignerToolGroup
                title={roundMode ? "Ring seating (curved rows)" : "Normal seats (rows & blocks)"}
              >
                {(roundMode ? RING_SEAT_PRESETS : NORMAL_SEAT_PRESETS).map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full justify-start gap-2 px-2 text-xs"
                    title={hasVenueZones ? preset.hint : "Complete Step 1 first"}
                    disabled={!hasVenueZones}
                    onClick={() => addGridSection(preset.rows, preset.cols)}
                  >
                    <Grid3X3 className="h-3.5 w-3.5 shrink-0" />
                    {preset.label}
                  </Button>
                ))}
              </DesignerToolGroup>
              <div className="space-y-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={groupSelectMode ? "default" : "outline"}
                  className="h-8 w-full justify-start gap-2 px-2 text-xs"
                  onClick={() => {
                    setGroupSelectMode((v) => !v);
                    if (groupSelectMode) setGroupedSeatKeys(new Set());
                  }}
                >
                  <MousePointer2 className="h-3.5 w-3.5 shrink-0" />
                  {groupSelectMode ? "Grouping on" : "Group seats"}
                </Button>
                {groupedSeatKeys.size > 0 && (
                  <div className="flex flex-col gap-1">
                    <select
                      className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) assignGroupedSeats(e.target.value);
                      }}
                    >
                      <option value="">Assign {groupedSeatKeys.size} seats to tier…</option>
                      {layout.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setGroupedSeatKeys(new Set())}
                    >
                      Clear selection
                    </Button>
                  </div>
                )}
              </div>
              <DesignerToolGroup title="Banquet / cabaret tables">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={tableSideMode === "TWO" ? "default" : "outline"}
                    className="h-7 flex-1 text-[10px]"
                    onClick={() => setTableSideMode("TWO")}
                  >
                    2 sides
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={tableSideMode === "FOUR" ? "default" : "outline"}
                    className="h-7 flex-1 text-[10px]"
                    onClick={() => setTableSideMode("FOUR")}
                  >
                    4 sides
                  </Button>
                </div>
                {TABLE_PACK_SIZES.map((pack) => (
                  <Button
                    key={pack}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full justify-start gap-2 px-2 text-xs"
                    disabled={!hasVenueZones}
                    onClick={() => addTablePack(pack)}
                    title={
                      hasVenueZones
                        ? `Add a ${pack}-seat table`
                        : "Complete Step 1 first"
                    }
                  >
                    <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" />
                    {pack}-pack table
                  </Button>
                ))}
              </DesignerToolGroup>
            </>
          )}

          {toolsTab === "stage" && (
            <>
              <DesignerToolGroup title="Stage & landmarks">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 px-2 text-xs"
                  onClick={() => addLandmark("STAGE_BOX")}
                >
                  <Square className="h-3.5 w-3.5 shrink-0" />
                  Stage
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 px-2 text-xs"
                  onClick={() => addLandmark("STAGE_ROUND")}
                >
                  <Circle className="h-3.5 w-3.5 shrink-0" />
                  Round stage
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 px-2 text-xs"
                  onClick={() => addLandmark("SCREEN")}
                >
                  <Monitor className="h-3.5 w-3.5 shrink-0" />
                  Screen
                </Button>
              </DesignerToolGroup>
              <DesignerToolGroup
                title="Audience view"
                hint="Front = straight rows facing stage. 360° = in the round with centre stage."
              >
                <div className="grid grid-cols-2 gap-1">
                  {ORIENTATIONS.map((o) => (
                    <Button
                      key={o.value}
                      type="button"
                      size="sm"
                      variant={isOrientationActive(layout.orientation, o.value) ? "default" : "outline"}
                      className="h-7 text-[10px]"
                      title={o.hint}
                      onClick={() => applyOrientation(o.value)}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Default row layout:{" "}
                  <span className="font-medium text-foreground">
                    {rowLayoutLabel(defaultRowLayoutForOrientation(layout.orientation))}
                  </span>
                </p>
              </DesignerToolGroup>
              <Button
                type="button"
                variant={showNaming ? "default" : "outline"}
                size="sm"
                className="h-8 w-full justify-start gap-2 px-2 text-xs"
                onClick={() => setShowNaming((v) => !v)}
              >
                <Type className="h-3.5 w-3.5 shrink-0" />
                Row / column naming
              </Button>
              {showNaming && (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
                  <label className="block">
                    <FieldLabel>Rows</FieldLabel>
                    <select
                      className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                      value={layout.naming.rowScheme}
                      onChange={(e) => updateNaming({ rowScheme: e.target.value as RowNamingScheme })}
                    >
                      {ROW_SCHEMES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Columns</FieldLabel>
                    <select
                      className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                      value={layout.naming.colScheme}
                      onChange={(e) => updateNaming({ colScheme: e.target.value as ColNamingScheme })}
                    >
                      {COL_SCHEMES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput
                      label="Row start"
                      value={layout.naming.rowStart ?? 1}
                      onChange={(n) => updateNaming({ rowStart: n })}
                      min={1}
                    />
                    <NumInput
                      label="Col start"
                      value={layout.naming.colStart ?? 1}
                      onChange={(n) => updateNaming({ colStart: n })}
                      min={1}
                    />
                  </div>
                  <label className="block">
                    <FieldLabel>Separator</FieldLabel>
                    <Input
                      value={layout.naming.separator ?? ""}
                      onChange={(e) => updateNaming({ separator: e.target.value })}
                      placeholder="A-1 or A1"
                      className="h-8 text-xs"
                    />
                  </label>
                  <p className="text-[10px] text-muted-foreground">
                    Preview:{" "}
                    <span className="font-mono">
                      {seatLabelFromIndices(0, 0, layout.naming)},{" "}
                      {seatLabelFromIndices(0, 1, layout.naming)}
                    </span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      }
      canvas={
        <>
          <div className="shrink-0 border-b px-2 py-1.5">
            <SeatLegend layout={layout} onlyConfigured={false} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-2">
            <SeatMapViewport
              seatCount={seatTotal}
              minHeight={520}
              showLargeMapHint={seatTotal > 200}
              className="min-h-0 flex-1 border-0 bg-transparent"
              contentSize={{ width: layoutExtents.width, height: layoutExtents.height }}
            >
            <SeatLayoutPreview
              layout={layout}
              designerMode
              embedded
              selectedSectionId={selection.kind === "section" ? selection.id : null}
              selectedLandmarkId={selection.kind === "landmark" ? selection.id : null}
              selectedZoneId={selection.kind === "zone" ? selection.id : null}
              onSectionClick={(id) => setSelection({ kind: "section", id })}
              onLandmarkClick={(id) => setSelection({ kind: "landmark", id })}
              onZoneClick={(id) => setSelection({ kind: "zone", id })}
              onSectionMove={(id, x, y, meta) => {
                const sec = layout.sections.find((s) => s.id === id);
                if (!sec) return;
                if (meta?.polar && isRingCurvedSection(sec, layout)) {
                  updateSection(id, moveRingSectionPolar(sec, layout, meta.deltaX, meta.deltaY));
                  return;
                }
                updateSection(id, { x, y });
              }}
              onLandmarkMove={(id, x, y) => updateLandmark(id, { x, y })}
              onZoneMove={(id, x, y) => updateZone(id, { x, y })}
              onSectionUpdate={(id, data) => updateSection(id, data)}
              onZoneUpdate={(id, data) => updateZone(id, data)}
              onLandmarkUpdate={(id, data) => updateLandmark(id, data)}
              groupSelectMode={groupSelectMode}
              groupedSeatKeys={groupedSeatKeys}
              onSeatGroupToggle={toggleSeatGroup}
            />
          </SeatMapViewport>
          </div>
          <p className="shrink-0 border-t px-2 py-1 text-[10px] text-muted-foreground">
            Delete removes selection · resize corners · purple arc rotates ·{" "}
            <Move className="inline h-3 w-3" /> or{" "}
            <kbd className="rounded border px-0.5 text-[9px]">Space</kbd> to pan
          </p>
        </>
      }
      propertiesPanel={
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Properties</p>
            {selection.kind !== "none" && (
              <Button type="button" variant="ghost" size="sm" onClick={deleteSelected}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>

          {selection.kind === "none" && (
            <div className="space-y-3 text-xs text-muted-foreground">
              <p>Select a venue area, seat block, table, or stage on the canvas.</p>
              {hasVenueZones && (
                <div>
                  <p className="mb-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                    Venue areas
                  </p>
                  <ul className="space-y-1">
                    {venueZones.map((z) => (
                      <li key={z.id}>
                        <button
                          type="button"
                          className="text-left text-sm text-foreground hover:underline"
                          onClick={() => setSelection({ kind: "zone", id: z.id })}
                        >
                          {z.parentZoneId ? "↳ " : ""}
                          {zoneDisplayName({ zones: venueZones }, z)}
                          <span className="ml-1 text-muted-foreground">
                            ({venueZoneKindLabel(z.kind)})
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {selectedZone && (
            <div className="space-y-3">
              <Badge variant="secondary">
                <MapPin className="mr-1 inline h-3 w-3" />
                Venue area
              </Badge>
              <label className="block">
                <FieldLabel>Area name</FieldLabel>
                <Input
                  value={selectedZone.name}
                  onChange={(e) => updateZone(selectedZone.id, { name: e.target.value })}
                  className="h-8"
                  placeholder="Main Hall, Ground Floor…"
                />
              </label>
              <label className="block">
                <FieldLabel>Pricing tier</FieldLabel>
                <select
                  className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                  value={selectedZone.categoryId ?? defaultCategoryId}
                  onChange={(e) => updateZone(selectedZone.id, { categoryId: e.target.value })}
                >
                  {layout.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {isStandingZone(selectedZone) && (
                <NumInput
                  label="Standing capacity"
                  value={selectedZone.capacity ?? 200}
                  onChange={(n) =>
                    updateZone(selectedZone.id, { capacity: Math.max(1, n) })
                  }
                  min={1}
                />
              )}
              {selectedZone.shape === "WEDGE" ? (
                <div className="grid grid-cols-2 gap-2">
                  <NumInput
                    label="Arc start (°)"
                    value={selectedZone.wedgeStartDeg ?? 0}
                    onChange={(n) => updateZone(selectedZone.id, { wedgeStartDeg: n })}
                  />
                  <NumInput
                    label="Arc end (°)"
                    value={selectedZone.wedgeEndDeg ?? 90}
                    onChange={(n) => updateZone(selectedZone.id, { wedgeEndDeg: n })}
                  />
                  <NumInput
                    label="Inner radius"
                    value={selectedZone.innerRadius ?? 80}
                    onChange={(n) => updateZone(selectedZone.id, { innerRadius: Math.max(20, n) })}
                    min={20}
                  />
                  <NumInput
                    label="Outer radius"
                    value={selectedZone.outerRadius ?? 200}
                    onChange={(n) => updateZone(selectedZone.id, { outerRadius: Math.max(40, n) })}
                    min={40}
                  />
                </div>
              ) : null}
              {selectedZone.shape === "WEDGE" && !isStandingZone(selectedZone) && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => addSeatsInWedgeZone(selectedZone.id)}
                  >
                    {sectionsInZone(layout, selectedZone.id).length
                      ? "Sync seats to wedge arc"
                      : "Add curved seats in this wedge"}
                  </Button>
                  {sectionsInZone(layout, selectedZone.id).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="block w-full rounded-md border px-2 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => setSelection({ kind: "section", id: s.id })}
                    >
                      ↳ {s.name}
                    </button>
                  ))}
                </div>
              )}
              {selectedZone.shape !== "WEDGE" ? (
              <div className="grid grid-cols-2 gap-2">
                <NumInput
                  label="Width"
                  value={selectedZone.width}
                  onChange={(n) => updateZone(selectedZone.id, { width: Math.max(80, n) })}
                  min={80}
                />
                <NumInput
                  label="Height"
                  value={selectedZone.height}
                  onChange={(n) => updateZone(selectedZone.id, { height: Math.max(60, n) })}
                  min={60}
                />
                <NumInput
                  label="X position"
                  value={selectedZone.x}
                  onChange={(n) => updateZone(selectedZone.id, { x: n })}
                />
                <NumInput
                  label="Y position"
                  value={selectedZone.y}
                  onChange={(n) => updateZone(selectedZone.id, { y: n })}
                />
              </div>
              ) : null}
              {selectedZone.shape !== "WEDGE" && !isStandingZone(selectedZone) && (
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={addSubZone}>
                  Add sub-zone inside this area
                </Button>
              )}
              {getChildZones({ zones: venueZones }, selectedZone.id).length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {getChildZones({ zones: venueZones }, selectedZone.id).length} nested sub-zone(s).
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {isStandingZone(selectedZone)
                  ? `Stand-up only - ${(selectedZone.capacity ?? 0).toLocaleString()} capacity, no individual seats.`
                  : `${layout.sections.filter((s) => s.zoneId === selectedZone.id).length} seat block(s) in this area.`}
              </p>
            </div>
          )}

          {selectedSection && (
            <div className="space-y-3">
              <Badge variant="secondary">
                {selectedSection.kind === "TABLE"
                  ? `Banquet · ${tableDescriptor(selectedSection)}`
                  : rowLayoutLabel(resolveRowLayout(selectedSection, layout))}
              </Badge>
              <label className="block">
                <FieldLabel>{selectedSection.kind === "TABLE" ? "Table name" : "Section name"}</FieldLabel>
                <Input
                  value={stripTableName(selectedSection.name)}
                  onChange={(e) => {
                    const base = e.target.value.trim() || "Table";
                    if (selectedSection.kind !== "TABLE") {
                      updateSection(selectedSection.id, { name: base });
                      return;
                    }
                    updateSection(selectedSection.id, {
                      name: `${base} (${tablePackLabel(getTablePackSize(selectedSection))}, ${tableSideLabel(getTableSideMode(selectedSection))})`,
                    });
                  }}
                  className="h-8"
                />
              </label>
              {selectedSection.kind === "GRID" && (
                <>
                  <label className="block">
                    <FieldLabel>Seat icon</FieldLabel>
                    <div className="grid grid-cols-2 gap-1">
                      {(["SQUARE", "ROUND"] as SeatShape[]).map((shape) => (
                        <Button
                          key={shape}
                          type="button"
                          size="sm"
                          variant={selectedSection.seatShape === shape || (!selectedSection.seatShape && shape === "SQUARE") ? "default" : "outline"}
                          onClick={() => updateSection(selectedSection.id, { seatShape: shape })}
                        >
                          {shape === "SQUARE" ? "Square" : "Round"}
                        </Button>
                      ))}
                    </div>
                  </label>
                  <label className="block">
                    <FieldLabel>Label prefix (e.g. L1-S2 → L1-S2-A1)</FieldLabel>
                    <Input
                      value={selectedSection.labelPrefix ?? ""}
                      onChange={(e) =>
                        updateSection(selectedSection.id, {
                          labelPrefix: e.target.value.trim() || undefined,
                        })
                      }
                      placeholder="GF-S1, L1-S2, BAL"
                      className="h-8"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput
                      label="Row naming offset"
                      value={selectedSection.namingOffset?.row ?? 0}
                      onChange={(n) =>
                        updateSection(selectedSection.id, {
                          namingOffset: {
                            ...selectedSection.namingOffset,
                            row: Math.max(0, n),
                          },
                        })
                      }
                      min={0}
                    />
                    <NumInput
                      label="Col naming offset"
                      value={selectedSection.namingOffset?.col ?? 0}
                      onChange={(n) =>
                        updateSection(selectedSection.id, {
                          namingOffset: {
                            ...selectedSection.namingOffset,
                            col: Math.max(0, n),
                          },
                        })
                      }
                      min={0}
                    />
                  </div>
                  <label className="block">
                    <FieldLabel>Seats per row (comma-separated for rings, e.g. 6,8,10)</FieldLabel>
                    <Input
                      value={formatRowColCounts(selectedSection.rowColCounts)}
                      onChange={(e) => {
                        const counts = parseRowColCounts(e.target.value);
                        updateSection(selectedSection.id, {
                          rowColCounts: counts,
                          rows: counts?.length ?? selectedSection.rows,
                          cols: counts ? Math.max(...counts) : selectedSection.cols,
                        });
                      }}
                      placeholder="6, 8, 10 - outer rows wider in 360°"
                      className="h-8 font-mono text-xs"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput
                      label="Centre aisle after col"
                      value={selectedSection.aisleAfterCol ?? -1}
                      onChange={(n) =>
                        updateSection(selectedSection.id, {
                          aisleAfterCol: n < 0 ? undefined : n,
                        })
                      }
                      min={-1}
                    />
                    <NumInput
                      label="Aisle gap (px)"
                      value={selectedSection.aisleGap ?? 24}
                      onChange={(n) =>
                        updateSection(selectedSection.id, { aisleGap: Math.max(8, n) })
                      }
                      min={8}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput
                      label={
                        isRingCurvedSection(selectedSection, layout)
                          ? "Arc bearing (°)"
                          : "Rotation (°)"
                      }
                      value={Math.round(
                        isRingCurvedSection(selectedSection, layout)
                          ? (selectedSection.curveBearingDeg ?? 0)
                          : (selectedSection.rotateDeg ?? 0)
                      )}
                      onChange={(n) =>
                        isRingCurvedSection(selectedSection, layout)
                          ? updateSection(selectedSection.id, {
                              curveBearingDeg: ((n % 360) + 360) % 360,
                              rotateDeg: 0,
                            })
                          : updateSection(selectedSection.id, {
                              rotateDeg: ((n % 360) + 360) % 360,
                            })
                      }
                      min={0}
                      max={359}
                    />
                    {resolveRowLayout(selectedSection, layout) === "CURVED" && (
                      <NumInput
                        label="Ring radius"
                        value={Math.round(selectedSection.curveInnerRadius ?? 120)}
                        onChange={(n) =>
                          updateSection(selectedSection.id, {
                            curveInnerRadius: Math.max(40, n),
                          })
                        }
                        min={40}
                      />
                    )}
                  </div>
                </>
              )}
              {selectedSection.kind === "TABLE" && (
                <>
                <label className="block">
                  <FieldLabel>Seats per table</FieldLabel>
                  <div className="grid grid-cols-4 gap-1">
                    {TABLE_PACK_SIZES.map((pack) => (
                      <Button
                        key={pack}
                        type="button"
                        size="sm"
                        variant={
                          getTablePackSize(selectedSection) === pack ? "default" : "outline"
                        }
                        className="h-8 px-0 text-xs"
                        onClick={() => setTablePackSize(selectedSection.id, pack)}
                      >
                        {pack}
                      </Button>
                    ))}
                  </div>
                </label>
                <label className="block">
                  <FieldLabel>Seating sides</FieldLabel>
                  <div className="grid grid-cols-2 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={getTableSideMode(selectedSection) === "TWO" ? "default" : "outline"}
                      onClick={() => setTableSides(selectedSection.id, "TWO")}
                    >
                      2 sides
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={getTableSideMode(selectedSection) === "FOUR" ? "default" : "outline"}
                      onClick={() => setTableSides(selectedSection.id, "FOUR")}
                    >
                      4 sides
                    </Button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {getTableSideMode(selectedSection) === "TWO"
                      ? `${getTablePackSize(selectedSection) / 2} seats on each long edge - typical concert VIP layout facing the stage.`
                      : `Seats distributed on all four sides (${getTablePackSize(selectedSection)} total).`}
                  </p>
                </label>
                </>
              )}
              {selectedSection.kind === "GRID" && (
                <>
                  <label className="block">
                    <FieldLabel>Row design</FieldLabel>
                    <select
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                      value={selectedSection.rowLayout ?? "AUTO"}
                      onChange={(e) =>
                        updateSection(selectedSection.id, {
                          rowLayout: e.target.value as SeatRowLayout,
                        })
                      }
                    >
                      {ROW_LAYOUT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Active: {rowLayoutLabel(resolveRowLayout(selectedSection, layout))}
                      {resolveRowLayout(selectedSection, layout) === "CURVED" && (
                        <>
                          {" "}
                          ·{" "}
                          {selectedSection.curveSpanDeg ??
                            orientationSpanDegrees(layout.orientation)}
                          ° arc toward stage
                        </>
                      )}
                    </p>
                  </label>
                  {resolveRowLayout(selectedSection, layout) === "CURVED" && (
                    <NumInput
                      label="Curve span (degrees)"
                      value={
                        selectedSection.curveSpanDeg ??
                        orientationSpanDegrees(layout.orientation)
                      }
                      onChange={(n) =>
                        updateSection(selectedSection.id, {
                          curveSpanDeg: Math.min(360, Math.max(20, n)),
                        })
                      }
                      min={20}
                      max={360}
                    />
                  )}
                </>
              )}
              {hasVenueZones && (
                <label className="block">
                  <FieldLabel>Venue area (hall / floor)</FieldLabel>
                  <select
                    className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                    value={selectedSection.zoneId ?? ""}
                    onChange={(e) => {
                      const zoneId = e.target.value || undefined;
                      const zone = zoneId ? venueZones.find((z) => z.id === zoneId) : undefined;
                      if (zone && isWedgeZone(zone)) {
                        updateSection(
                          selectedSection.id,
                          sectionGeometryFromZone(
                            { ...selectedSection, zoneId },
                            zone,
                            layout
                          )
                        );
                      } else {
                        updateSection(selectedSection.id, { zoneId });
                      }
                    }}
                  >
                    <option value="">- Not assigned -</option>
                    {venueZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.parentZoneId ? "↳ " : ""}
                        {zoneDisplayName({ zones: venueZones }, z)}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const z = venueZones.find((zn) => zn.id === selectedSection.zoneId);
                    if (!z || !isWedgeZone(z)) return null;
                    return (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={snapSelectedSectionToZone}
                    >
                      Snap seats to wedge arc
                    </Button>
                    );
                  })()}
                </label>
              )}
              <label className="block">
                <FieldLabel>Ticket pricing tier</FieldLabel>
                <div className="flex items-center gap-2">
                  <span
                    className="h-8 w-8 shrink-0 rounded-md border shadow-sm"
                    style={{
                      backgroundColor:
                        layout.categories.find((c) => c.id === selectedSection.categoryId)?.color ??
                        "#3b82f6",
                    }}
                    title="Zone colour on map"
                  />
                  <select
                    className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                    value={selectedSection.categoryId}
                    onChange={(e) => updateSection(selectedSection.id, { categoryId: e.target.value })}
                  >
                    {layout.categories.map((c) => {
                      const pkg = ticketPackages?.find((p) => p.id === c.id);
                      if (pkg?.ticketKind === "STANDING") return null;
                      const remaining = categoryRemainingForSection(c.id, selectedSection);
                      const blockSeats = countSectionSeats(selectedSection, layout);
                      const label =
                        ticketPackages?.length && remaining !== Infinity
                          ? `${c.name} (${remaining} left)`
                          : c.name;
                      return (
                        <option
                          key={c.id}
                          value={c.id}
                          disabled={remaining < blockSeats && c.id !== selectedSection.categoryId}
                        >
                          {label}
                          {remaining < blockSeats && c.id !== selectedSection.categoryId
                            ? " - full"
                            : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {ticketPackages?.length ? (
                  (() => {
                    const cap = capacityByCategory.find(
                      (c) => c.categoryId === selectedSection.categoryId
                    );
                    const blockSeats = countSectionSeats(selectedSection, layout);
                    if (!cap) return null;
                    return (
                      <p
                        className={cn(
                          "mt-1.5 rounded-md px-2 py-1.5 text-[11px]",
                          cap.status === "ok" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                          cap.status === "under" && "bg-amber-500/10 text-amber-800 dark:text-amber-200",
                          cap.status === "over" && "bg-red-500/10 text-red-700 dark:text-red-300"
                        )}
                      >
                        This block: <strong>{blockSeats}</strong> seats · Category total:{" "}
                        <strong>
                          {cap.mapped}/{cap.qtyTotal}
                        </strong>
                        {cap.remaining > 0
                          ? ` · ${cap.remaining} ticket(s) still to place`
                          : cap.status === "ok"
                            ? " · complete"
                            : " · over limit"}
                      </p>
                    );
                  })()
                ) : (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Seat colour on the map reflects the pricing tier (VIP, Standard, etc.).
                  </p>
                )}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedSection.enabled}
                  onChange={(e) => updateSection(selectedSection.id, { enabled: e.target.checked })}
                />
                Section enabled (visible to buyers)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {selectedSection.kind === "GRID" && (
                  <>
                    <NumInput
                      label="Rows"
                      value={selectedSection.rows}
                      onChange={(n) => updateSection(selectedSection.id, { rows: Math.max(1, n) })}
                      min={1}
                      max={200}
                    />
                    <NumInput
                      label="Columns"
                      value={selectedSection.cols}
                      onChange={(n) => updateSection(selectedSection.id, { cols: Math.max(1, n) })}
                      min={1}
                      max={200}
                    />
                  </>
                )}
                <NumInput
                  label="X position"
                  value={selectedSection.x}
                  onChange={(n) => updateSection(selectedSection.id, { x: n })}
                />
                <NumInput
                  label="Y position"
                  value={selectedSection.y}
                  onChange={(n) => updateSection(selectedSection.id, { y: n })}
                />
              </div>
              {sampleLabels && (
                <p className="text-xs text-muted-foreground">
                  Sample labels: <span className="font-mono">{sampleLabels}…</span>
                </p>
              )}
            </div>
          )}

          {selectedLandmark && (
            <div className="space-y-3">
              <Badge variant="secondary">
                {selectedLandmark.type === "STAGE_ROUND"
                  ? "Round stage"
                  : selectedLandmark.type === "SCREEN"
                    ? "Screen"
                    : "Stage"}
              </Badge>
              <label className="block">
                <FieldLabel>Label</FieldLabel>
                <Input
                  value={selectedLandmark.label ?? ""}
                  onChange={(e) => updateLandmark(selectedLandmark.id, { label: e.target.value })}
                  className="h-8"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <NumInput
                  label="X"
                  value={selectedLandmark.x}
                  onChange={(n) => updateLandmark(selectedLandmark.id, { x: n })}
                />
                <NumInput
                  label="Y"
                  value={selectedLandmark.y}
                  onChange={(n) => updateLandmark(selectedLandmark.id, { y: n })}
                />
                {selectedLandmark.type === "STAGE_ROUND" ? (
                  <NumInput
                    label="Radius"
                    value={selectedLandmark.radius ?? 80}
                    onChange={(n) => updateLandmark(selectedLandmark.id, { radius: n })}
                    min={20}
                  />
                ) : (
                  <>
                    <NumInput
                      label="Width"
                      value={selectedLandmark.width ?? 200}
                      onChange={(n) => updateLandmark(selectedLandmark.id, { width: n })}
                      min={20}
                    />
                    <NumInput
                      label="Height"
                      value={selectedLandmark.height ?? 60}
                      onChange={(n) => updateLandmark(selectedLandmark.id, { height: n })}
                      min={8}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ticket pricing tiers
              </p>
              {!ticketPackages?.length && (
                <Button type="button" variant="ghost" size="sm" onClick={addCategory}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              {ticketPackages?.length
                ? "Tiers come from event ticket categories. Edit name, price, and quantity on the event page."
                : "Pricing tiers control seat colour and price. Venue areas (Step 1) define hall / floor layout."}
            </p>
            <ul className="space-y-3">
              {layout.categories.map((cat) => {
                const linkedPkg = ticketPackages?.find((p) => p.id === cat.id);
                const locked = Boolean(linkedPkg);
                const cap = capacityByCategory.find((c) => c.categoryId === cat.id);
                const usesMap =
                  cap &&
                  (linkedPkg?.ticketKind === "SEATED" ||
                    linkedPkg?.ticketKind === "STANDING" ||
                    cap.mapped > 0);
                return (
                <li key={cat.id} className="rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cat.color}
                      onChange={(e) => updateCategory(cat.id, { color: e.target.value })}
                      className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
                      title="Zone colour"
                    />
                    {locked ? (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{cat.name}</p>
                        {linkedPkg && (
                          <p className="text-[10px] text-muted-foreground">
                            {TICKET_KIND_LABELS[linkedPkg.ticketKind]} · qty {linkedPkg.qtyTotal}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Input
                        value={cat.name}
                        onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
                        className="h-7 flex-1 text-sm"
                        placeholder="Zone name"
                      />
                    )}
                    {!locked && layout.categories.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeCategory(cat.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {locked ? (
                      <p className="text-sm font-semibold tabular-nums">
                        {Math.round(cat.price / 100).toLocaleString()} LKR
                      </p>
                    ) : (
                      <>
                        <Input
                          type="number"
                          min={0}
                          step={100}
                          value={Math.round(cat.price / 100)}
                          onChange={(e) =>
                            updateCategory(cat.id, { price: Math.round(Number(e.target.value) || 0) * 100 })
                          }
                          className="h-7 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">LKR</span>
                      </>
                    )}
                    <label className="ml-auto flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={cat.enabled}
                        onChange={(e) => updateCategory(cat.id, { enabled: e.target.checked })}
                      />
                      On
                    </label>
                  </div>
                  {usesMap && cap && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {linkedPkg?.ticketKind === "STANDING"
                            ? "Standing capacity on map"
                            : `${cap.blocks} block${cap.blocks === 1 ? "" : "s"} on map`}
                        </span>
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            cap.status === "ok" && "text-emerald-600",
                            cap.status === "under" && "text-amber-600",
                            cap.status === "over" && "text-red-600"
                          )}
                        >
                          {cap.mapped}/{cap.qtyTotal}
                          {cap.remaining > 0 ? ` · ${cap.remaining} left` : cap.status === "ok" ? " · done" : ""}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            cap.status === "over" && "bg-red-500",
                            cap.status === "ok" && "bg-emerald-500",
                            cap.status === "under" && "bg-amber-500",
                            cap.status === "empty" && "bg-muted-foreground/30"
                          )}
                          style={{
                            width: `${Math.min(100, Math.round((cap.mapped / cap.qtyTotal) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
              })}
            </ul>
          </div>
        </div>
      }
    />
  );
}
