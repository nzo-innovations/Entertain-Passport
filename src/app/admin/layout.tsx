import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/auth";
import { UserRole, ApprovalStatus } from "@/lib/types";
import { db } from "@/lib/db";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/third-eye/999/login");
  if (session.role !== UserRole.SUPER_ADMIN) redirect("/portal");

  const pendingCount = await db.event.count({
    where: { approvalStatus: ApprovalStatus.PENDING_REVIEW },
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r bg-card/40 lg:block">
        <div className="flex h-16 items-center border-b px-5">
          <Logo />
        </div>

        <div className="px-3 py-4">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Super Admin
          </p>
          <div className="mt-2 flex items-center gap-3 rounded-xl border bg-background p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg gradient-brand text-sm font-bold text-white">
              SA
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{session.name}</p>
              <p className="text-[10px] text-muted-foreground">Platform owner</p>
            </div>
          </div>
        </div>

        <AdminSidebarNav pendingCount={pendingCount} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 min-h-14 items-center gap-2 border-b glass px-4 sm:h-16 sm:gap-3 sm:px-6">
          <AdminMobileNav pendingCount={pendingCount} />
          <h1 className="truncate font-display text-base font-semibold sm:text-lg">Super Admin</h1>
          <Badge variant="brand" className="hidden shrink-0 sm:inline-flex">Platform</Badge>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Link href="/" className="hidden rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent sm:inline-flex">
              Public site
            </Link>
            <LogoutButton />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
