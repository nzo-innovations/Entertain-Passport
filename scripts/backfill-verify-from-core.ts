/**
 * Backfill verification plane from CORE RfidCard rows when the legacy verify
 * Supabase project is unreachable. Reuses the same one-way sync as Admin NFC.
 *
 *   npm run verify:backfill-from-core
 */
import { PrismaClient as CoreClient } from "@prisma/client";
import { syncIdentity, provisionCardKey } from "../src/lib/verify/sync";

async function main() {
  const core = new CoreClient();
  const cards = await core.rfidCard.findMany({
    include: {
      assignedUser: { select: { name: true, nic: true, phone: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[verify:backfill-from-core] ${cards.length} NFC cards in core DB`);

  let synced = 0;
  let keys = 0;
  let failed = 0;

  for (const card of cards) {
    try {
      await syncIdentity({
        uid: card.uid,
        passportNo: card.passportNo,
        status: card.status,
        adminLabel: card.label,
        name: card.assignedUser?.name ?? null,
        nic: card.assignedUser?.nic ?? null,
        mobile: card.assignedUser?.phone ?? null,
      });
      synced++;
      try {
        await provisionCardKey(card.passportNo, card.uid);
        keys++;
      } catch {
        // identity may exist without re-provisioning keys on every run
      }
    } catch (err) {
      failed++;
      console.error(`  failed ${card.passportNo}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[verify:backfill-from-core] identities synced: ${synced}, keys provisioned: ${keys}, failed: ${failed}`);
  await core.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
