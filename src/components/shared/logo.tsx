import Link from "next/link";
import { Stamp } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-display", className)}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-white shadow-lg shadow-primary/30">
        <Stamp className="h-5 w-5" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-white" />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-[14px] font-semibold tracking-tight sm:text-[15px]">Entertain Passport</span>
        <span className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
          by nZO Innovations
        </span>
      </span>
    </Link>
  );
}
