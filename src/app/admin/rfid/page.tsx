import { db } from "@/lib/db";
import { RfidManager } from "@/components/admin/rfid-manager";

export const dynamic = "force-dynamic";

export default async function AdminRfidPage() {
  const cards = await db.rfidCard.findMany({
    orderBy: { createdAt: "desc" },
    include: { assignedUser: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Entertain Passports (NFC/RFID)</h1>
        <p className="text-sm text-muted-foreground">
          Program RFID cards and assign them to members. A holder taps their
          passport at the gate to enter - and earns loyalty rewards on purchases.
        </p>
      </header>

      <RfidManager
        initial={cards.map((c) => ({
          id: c.id,
          uid: c.uid,
          passportNo: c.passportNo,
          label: c.label,
          status: c.status,
          assignedEmail: c.assignedUser?.email ?? null,
          assignedName: c.assignedUser?.name ?? null,
        }))}
      />
    </div>
  );
}
