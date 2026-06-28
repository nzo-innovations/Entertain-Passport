import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateNic } from "@/lib/nic";

const schema = z.object({
  nic: z.string().trim().min(1).max(30),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, available: false, error: "NIC is required." },
      { status: 400 }
    );
  }

  const validation = validateNic(parsed.data.nic);
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
        { nic: validation.normalized },
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
        error: "That NIC is already linked to another account.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    available: true,
    normalized: validation.normalized,
  });
}
