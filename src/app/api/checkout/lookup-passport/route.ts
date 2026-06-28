import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  passportNo: z.string().trim().min(3).max(40),
});

export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid Entertain Passport number." }, { status: 400 });
  }

  const query = parsed.data.passportNo.trim().toUpperCase();
  const card = await db.rfidCard.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ passportNo: query }, { uid: query }],
    },
    include: {
      assignedUser: {
        select: { id: true, name: true, firstName: true, lastName: true },
      },
    },
  });

  if (!card) {
    return NextResponse.json({ found: false });
  }

  const user = card.assignedUser;
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.name || "Entertain Passport member";

  return NextResponse.json({
    found: true,
    passportNo: card.passportNo,
    displayName,
    userId: user?.id ?? null,
  });
}
