"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { CustomerAccountMenu, CustomerAccountMenuMobile } from "./customer-account-menu";
import { useCart } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

import { PLACES_LABEL } from "@/lib/config";

const NAV = [
  { label: "Discover", href: "/" },
  { label: "Shows", href: "/events" },
  { label: "Genres", href: "/genres" },
  { label: PLACES_LABEL, href: "/venues" },
];

export function Header() {
  const pathname = usePathname();
  const lines = useCart((s) => s.lines);
  const openCart = useCart((s) => s.openCart);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-transparent transition-all duration-200",
        scrolled ? "border-border/60 glass" : "bg-transparent"
      )}
    >
      <div className="container flex h-14 min-h-14 items-center gap-2 sm:h-16 sm:gap-4">
        <Logo className="min-w-0 shrink" />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active =
              n.href === "/" ? pathname === "/" : pathname.startsWith(n.href.split("?")[0]);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
          <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
            <Link href="/events" aria-label="Search">
              <Search className="h-5 w-5" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={openCart}
            aria-label="Open cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {totalQty > 0 && (
              <Badge
                variant="brand"
                className="absolute -right-1 -top-1 h-5 min-w-[20px] justify-center px-1 text-[10px]"
              >
                {totalQty}
              </Badge>
            )}
          </Button>

          <ThemeToggle />

          <CustomerAccountMenu />

          <Button variant="brand" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/organizer/login">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Publish event</span>
              <span className="sm:hidden">Publish</span>
            </Link>
          </Button>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100vw-2rem,360px)] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {NAV.map((n) => {
                  const active =
                    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href.split("?")[0]);
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "rounded-lg px-3 py-2.5 text-sm font-medium",
                        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-6 flex flex-col gap-2 border-t pt-6">
                <CustomerAccountMenuMobile onNavigate={() => setMenuOpen(false)} />
                <Button variant="brand" asChild className="w-full justify-center">
                  <Link href="/organizer/login" onClick={() => setMenuOpen(false)}>
                    <Sparkles className="h-4 w-4" />
                    Publish event
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
