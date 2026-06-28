"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlacesViewToggle() {
  const router = useRouter();
  const params = useSearchParams();
  const view = params.get("view") === "agenda" ? "agenda" : "grid";

  const setView = (next: "grid" | "agenda") => {
    const search = new URLSearchParams(params.toString());
    if (next === "grid") search.delete("view");
    else search.set("view", "agenda");
    const qs = search.toString();
    router.replace(`/venues${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  return (
    <div
      className="inline-flex rounded-xl border bg-muted/40 p-1"
      role="tablist"
      aria-label="Places view"
    >
      <ViewButton
        active={view === "grid"}
        onClick={() => setView("grid")}
        icon={LayoutGrid}
        label="Places"
      />
      <ViewButton
        active={view === "agenda"}
        onClick={() => setView("agenda")}
        icon={CalendarDays}
        label="This week"
      />
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
