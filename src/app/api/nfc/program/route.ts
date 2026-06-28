import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { programNfcForAssignedPassport } from "@/lib/passport/nfc-programming-service";

const schema = z.object({
  publicPassportNumber: z.string().min(10),
  nfcUid: z.string().trim().min(4).max(64),
  reprogram: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ status: "DENY", reason: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ status: "DENY", reason: "Invalid program payload." }, { status: 400 });
  }

  try {
    const result = await programNfcForAssignedPassport({
      ...parsed.data,
      programmedById: admin.id,
    });
    return NextResponse.json({
      status: "OK",
      reason: result.reprogrammed
        ? "NFC re-programmed. Write both tag records to the chip, then verify on Test card tab."
        : "NFC programmed. Write both tag records to the chip, then verify on Test card tab.",
      tagPayload: result.tagPayload,
      publicDisplay: result.publicDisplay,
      formattedPassportNumber: result.formattedPassportNumber,
      holderName: result.holderName,
      programmingId: result.programmingId,
      rfidCardId: result.rfidCardId,
      reprogrammed: result.reprogrammed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Programming failed.";
    return NextResponse.json({ status: "DENY", reason: message }, { status: 409 });
  }
}
