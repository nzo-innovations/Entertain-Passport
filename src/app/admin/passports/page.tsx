import { PassportInventoryManager } from "@/components/admin/passport-inventory-manager";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPassportInventoryPage() {
  const [batches, inventory] = await Promise.all([
    db.passportBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { _count: { select: { inventory: true } } },
    }),
    db.passportNumberInventory.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        batch: { select: { batchCode: true } },
        assignedUser: { select: { name: true, email: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Passport inventory &amp; programming</h1>
        <p className="text-sm text-muted-foreground">
          Bulk-generate public 16-digit Entertain Passport numbers for printing, assign to customers,
          then program NFC chips with secure internal UUIDs and HMAC signatures.
        </p>
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Public numbers are not payment card numbers and must never be used for payment processing.
        </p>
      </header>

      <PassportInventoryManager
        initialBatches={batches.map((b) => ({
          ...b,
          createdAt: b.createdAt.toISOString(),
        }))}
        initialInventory={inventory}
      />
    </div>
  );
}
