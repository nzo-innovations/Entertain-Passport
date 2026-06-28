import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEventDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { TicketAssign } from "@/components/account/ticket-assign";
import { profileIdentityDisplay } from "@/lib/profile";
import { ROUTES } from "@/lib/config";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams?: { ok?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [tickets, passport, user] = await Promise.all([
    db.ticket.findMany({
      where: { orderItem: { order: { userId: session.id } } },
      include: {
        rfidCard: { select: { passportNo: true } },
        holder: { select: { name: true, nic: true, idType: true, idNumber: true } },
        orderItem: {
          include: {
            event: { include: { category: true } },
            package: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.rfidCard.findFirst({
      where: { assignedUserId: session.id, status: "ACTIVE" },
      select: { passportNo: true },
    }),
    db.user.findUnique({
      where: { id: session.id },
      select: { nic: true, idType: true, idNumber: true },
    }),
  ]);

  const just = searchParams?.ok === "1";
  const userIdentity = profileIdentityDisplay(user);

  return (
    <>
      <Header />
      <main className="container max-w-3xl py-16">
        {just && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">Payment confirmed!</p>
              <p className="text-sm text-muted-foreground">Your tickets are below in your wallet.</p>
            </div>
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">My tickets</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap your Entertain Passport at the gate, or verify with your ID.
            </p>
          </div>
          <Link href={ROUTES.profile} className="text-sm font-medium text-primary hover:underline">
            My profile
          </Link>
        </div>

        {passport && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">
                Entertain Passport: <span className="font-mono">{passport.passportNo}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Linked to your account. Tap at the gate to enter events.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              No tickets yet.{" "}
              <Link href="/events" className="text-primary hover:underline">
                Browse shows
              </Link>
            </div>
          ) : (
            tickets.map((t) => {
              const holderLabel = t.holderUserId === session.id ? "You" : t.holderName ?? "You";
              const holderIdentity =
                (t.holderNic ? `ID ${t.holderNic}` : null) ??
                profileIdentityDisplay(t.holder) ??
                (t.holderUserId === session.id ? userIdentity : null);
              const entryLabel = t.rfidCard?.passportNo
                ? `Entertain Passport ${t.rfidCard.passportNo}`
                : holderIdentity
                  ? holderIdentity
                  : "ID verification at gate";
              return (
                <div key={t.id} className="overflow-hidden rounded-2xl border bg-card">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px]">
                    <div className="space-y-3 p-5">
                      <Badge variant="brand">{t.orderItem.event.category.name}</Badge>
                      <h3 className="font-display text-xl font-semibold">{t.orderItem.event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t.orderItem.package.name} · {formatEventDate(t.orderItem.event.startsAt)}
                      </p>
                      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">{entryLabel}</div>
                      <Badge variant={t.status === "CHECKED_IN" ? "success" : "outline"}>
                        {t.status === "CHECKED_IN" ? "Used · checked in" : "Valid · not used"}
                      </Badge>
                      {passport && t.status !== "CHECKED_IN" && (
                        <TicketAssign ticketId={t.id} holder={holderLabel} />
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center gap-2 border-t bg-muted/30 p-5 sm:border-l sm:border-t-0">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <CreditCard className="h-10 w-10" />
                      </div>
                      <p className="text-center text-[10px] text-muted-foreground">
                        {t.rfidCard?.passportNo
                          ? "Tap your Entertain Passport at the gate"
                          : "Verify with your ID at the gate"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/events">Find your next show</Link>
          </Button>
          {!passport && (
            <Button variant="brand" asChild>
              <Link href={ROUTES.passport}>Order Entertain Passport</Link>
            </Button>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
