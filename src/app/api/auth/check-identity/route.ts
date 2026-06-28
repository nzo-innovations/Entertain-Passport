import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateIdentity } from "@/lib/identity";

const schema = z.object({
  idType: z.enum(["NIC", "PASSPORT"]),
  idNumber: z.string().trim().min(1).max(40),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, available: false, error: "Identity number is required." },
      { status: 400 }
    );
  }

  const validation = validateIdentity(parsed.data.idType, parsed.data.idNumber);
  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        available: false,
        normalized: validation.normalized,
        error: validation.error,
      },
      { status: 400 }
    );
  }

  const existing = await db.user.findFirst({
    where: {
      OR: [
        { idNumber: validation.normalized },
        ...(parsed.data.idType === "NIC" ? [{ nic: validation.normalized }] : []),
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        available: false,
        normalized: validation.normalized,
        error:
          parsed.data.idType === "PASSPORT"
            ? "That passport number is already linked to another account."
            : "That NIC is already linked to another account.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    available: true,
    normalized: validation.normalized,
    idType: parsed.data.idType,
  });
}
