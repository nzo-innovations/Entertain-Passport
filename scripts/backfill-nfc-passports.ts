/**
 * Backfill passportId + HMAC signatures for legacy RfidCard rows.
 * Run: npx tsx scripts/backfill-nfc-passports.ts
 */
import { db } from "../src/lib/db";
import { buildTagPayload, ensureDefaultKeyVersion, getActiveKeyVersion } from "../src/lib/nfc/crypto-service";
import { generatePassportId } from "../src/lib/nfc/passport-service";

async function main() {
  await ensureDefaultKeyVersion();
  const keyVersion = await getActiveKeyVersion();

  const cards = await db.rfidCard.findMany({
    where: { OR: [{ passportId: null }, { signature: null }] },
  });

  console.log(`[backfill-nfc] ${cards.length} cards to update`);

  for (const card of cards) {
    const passportId = card.passportId ?? generatePassportId();
    const issuedAt = card.issuedAt ?? card.createdAt;
    const counter = card.counter ?? 0;
    const tagPayload = buildTagPayload({
      passportId,
      cardUid: card.uid,
      keyVersion,
      issuedAt,
      counter,
    });

    await db.rfidCard.update({
      where: { id: card.id },
      data: {
        passportId,
        keyVersion: card.keyVersion || keyVersion,
        issuedAt,
        counter,
        signature: tagPayload.signature,
      },
    });
    console.log(`  updated ${card.passportNo} → ${passportId}`);
  }

  console.log("[backfill-nfc] done");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
