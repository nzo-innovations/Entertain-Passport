import { db } from "@/lib/db";
import { RfidManager } from "@/components/admin/rfid-manager";
import { getNfcAnalyticsSummary } from "@/lib/nfc/analytics";

export const dynamic = "force-dynamic";

export default async function AdminNfcPage() {
  const [cards, analytics, pendingOrders] = await Promise.all([
    db.rfidCard.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assignedUser: { select: { name: true, email: true } },
        passportCardOrder: { select: { id: true, status: true } },
      },
    }),
    getNfcAnalyticsSummary(),
    db.passportCardOrder.findMany({
      where: { status: { in: ["PAID", "DEFERRED"] } },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { name: true, email: true } },
        rfidCards: { select: { id: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Entertain Passports (NFC)</h1>
        <p className="text-sm text-muted-foreground">
          Program secure NFC tags from customer orders or manual mode. Tags store only a signed
          identity token - no personal data on the chip. Tickets are validated server-side at the gate.
        </p>
      </header>

      <RfidManager
        analytics={analytics}
        pendingOrders={pendingOrders.map((o) => ({
          id: o.id,
          userEmail: o.user.email,
          userName: o.user.name,
          quantity: o.quantity,
          fulfilledCount: o.rfidCards.length,
          status: o.status,
        }))}
        initial={cards.map((c) => ({
          id: c.id,
          uid: c.uid,
          passportId: c.passportId ?? "",
          passportNo: c.passportNo,
          label: c.label,
          status: c.status,
          keyVersion: c.keyVersion,
          counter: c.counter,
          issuedAt: c.issuedAt.toISOString(),
          assignedEmail: c.assignedUser?.email ?? null,
          assignedName: c.assignedUser?.name ?? null,
          orderId: c.passportCardOrder?.id ?? null,
        }))}
      />
    </div>
  );
}
