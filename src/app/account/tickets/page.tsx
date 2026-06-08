import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Nfc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEventDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { TicketAssign } from "@/components/account/ticket-assign";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams?: { ok?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const tickets = await db.ticket.findMany({
    where: { orderItem: { order: { userId: session.id } } },
    include: {
      rfidCard: { select: { passportNo: true } },
      holder: { select: { name: true } },
      orderItem: {
        include: {
          event: { include: { category: true } },
          package: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const passport = await db.rfidCard.findFirst({
    where: { assignedUserId: session.id, status: "ACTIVE" },
    select: { passportNo: true },
  });

  const just = searchParams?.ok === "1";

  return (
    <>
      <Header />
      <main className="container max-w-3xl py-16">
        {just && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">Payment confirmed!</p>
              <p className="text-sm text-muted-foreground">Your tickets are below with scannable barcodes.</p>
            </div>
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">My tickets</h1>
          <Link href="/account/profile" className="text-sm font-medium text-primary hover:underline">
            My profile
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          We use NFC/RFID Entertain Passports - tap your card at the gate to enter.
        </p>

        <div
          className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${
            passport ? "border-primary/30 bg-primary/5" : "border-dashed"
          }`}
        >
          <Nfc className={`h-5 w-5 shrink-0 ${passport ? "text-primary" : "text-muted-foreground"}`} />
          {passport ? (
            <div>
              <p className="font-medium">
                Your Entertain Passport: <span className="font-mono">{passport.passportNo}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Tap at the gate to enter. You earn loyalty rewards on every purchase, and can
                assign extra tickets to friends below.
              </p>
            </div>
          ) : (
            <div>
              <p className="font-medium">You don&apos;t have an Entertain Passport yet</p>
              <p className="text-sm text-muted-foreground">
                Request an NFC/RFID card to tap-in at the gate and earn loyalty rewards. You can
                still buy and use tickets without one.
              </p>
            </div>
          )}
        </div>

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
              return (
              <div key={t.id} className="overflow-hidden rounded-2xl border bg-card">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px]">
                  <div className="space-y-3 p-5">
                    <Badge variant="brand">{t.orderItem.event.category.name}</Badge>
                    <h3 className="font-display text-xl font-semibold">{t.orderItem.event.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t.orderItem.package.name} · {formatEventDate(t.orderItem.event.startsAt)}
                    </p>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2 font-mono text-sm tracking-wider">
                      {t.ticketCode || t.rfidCard?.passportNo || t.barcode}
                    </div>
                    <Badge variant={t.status === "CHECKED_IN" ? "success" : "outline"}>
                      {t.status === "CHECKED_IN" ? "Used · checked in" : "Valid · not used"}
                    </Badge>
                    {passport && t.status !== "CHECKED_IN" && (
                      <TicketAssign ticketId={t.id} holder={holderLabel} />
                    )}
                  </div>
                  <div className="flex flex-col items-center justify-center gap-2 border-t bg-muted/30 p-5 sm:border-l sm:border-t-0">
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Nfc className="h-12 w-12" />
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground">
                      {t.rfidCard?.passportNo ? "Tap your passport at the gate" : "Show code at the gate"}
                    </p>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>

        <div className="mt-10 text-center">
          <Button variant="outline" asChild>
            <Link href="/events">Find your next show</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </>
  );
}
