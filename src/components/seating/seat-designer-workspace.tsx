"use client";

import * as React from "react";
import { PanelLeft, PanelRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DesignerToolsTab = "setup" | "zones" | "seats" | "stage";

const TOOL_TABS: { id: DesignerToolsTab; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "zones", label: "Zones" },
  { id: "seats", label: "Seats" },
  { id: "stage", label: "Stage" },
];

type Props = {
  commandBar: React.ReactNode;
  toolsPanel: React.ReactNode;
  canvas: React.ReactNode;
  propertiesPanel: React.ReactNode;
  toolsTab: DesignerToolsTab;
  onToolsTabChange: (tab: DesignerToolsTab) => void;
  mobileToolsOpen: boolean;
  onMobileToolsOpenChange: (open: boolean) => void;
  mobilePropsOpen: boolean;
  onMobilePropsOpenChange: (open: boolean) => void;
};

export function SeatDesignerWorkspace({
  commandBar,
  toolsPanel,
  canvas,
  propertiesPanel,
  toolsTab,
  onToolsTabChange,
  mobileToolsOpen,
  onMobileToolsOpenChange,
  mobilePropsOpen,
  onMobilePropsOpenChange,
}: Props) {
  return (
    <div className="flex h-[min(920px,calc(100vh-7rem))] min-h-[640px] flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {commandBar}
      </header>

      <div className="relative flex min-h-0 flex-1">
        {mobileToolsOpen && (
          <button
            type="button"
            aria-label="Close tools"
            className="absolute inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => onMobileToolsOpenChange(false)}
          />
        )}

        <aside
          className={cn(
            "flex w-[260px] shrink-0 flex-col border-r bg-muted/20",
            mobileToolsOpen
              ? "absolute inset-y-0 left-0 z-30 shadow-xl md:relative md:shadow-none"
              : "hidden md:flex"
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-2 py-1.5 md:hidden">
            <span className="text-xs font-semibold">Tools</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onMobileToolsOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b p-1">
            {TOOL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onToolsTabChange(tab.id)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  toolsTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">{toolsPanel}</div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">{canvas}</main>

        <aside
          className={cn(
            "flex w-[280px] shrink-0 flex-col border-l bg-card/40",
            mobilePropsOpen ? "flex" : "hidden",
            "xl:flex"
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-3 py-2 xl:hidden">
            <span className="text-xs font-semibold">Properties</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onMobilePropsOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{propertiesPanel}</div>
        </aside>
      </div>
    </div>
  );
}

export function DesignerMobileToggles({
  onOpenTools,
  onOpenProperties,
}: {
  onOpenTools: () => void;
  onOpenProperties: () => void;
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="md:hidden"
        onClick={onOpenTools}
      >
        <PanelLeft className="h-4 w-4" />
        Tools
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="xl:hidden"
        onClick={onOpenProperties}
      >
        <PanelRight className="h-4 w-4" />
        Props
      </Button>
    </>
  );
}

export function DesignerToolGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {hint ? <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
