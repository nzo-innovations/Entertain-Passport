import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  passportNo: z.string().trim().max(40).optional(),
  nic: z.string().trim().max(30).optional(),
  name: z.string().trim().max(80).optional(),
});

// Buyer assigns one of their tickets to a friend by Entertain Passport number or
// NIC. Only available to buyers who hold an active passport. Rewards stay with
// the original buyer; this only sets who may enter on that ticket.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticket = await db.ticket.findUnique({
    where: { id: params.id },
    include: { orderItem: { include: { order: { select: { userId: true } } } } },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (ticket.orderItem.order.userId !== session.id) {
    return NextResponse.json({ error: "Not your ticket." }, { status: 403 });
  }

  const buyerCard = await db.rfidCard.findFirst({
    where: { assignedUserId: session.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!buyerCard) {
    return NextResponse.json(
      { error: "Assigning tickets to friends requires an active Entertain Passport." },
      { status: 403 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { passportNo, nic, name } = parsed.data;

  // Reset back to the buyer when nothing provided.
  if (!passportNo && !nic) {
    await db.ticket.update({
      where: { id: ticket.id },
      data: { holderUserId: session.id, holderName: null, holderNic: null, rfidCardId: buyerCard.id },
    });
    return NextResponse.json({ ok: true, holder: "You" });
  }

  if (passportNo) {
    const card = await db.rfidCard.findFirst({
      where: { OR: [{ passportNo }, { uid: passportNo }] },
      include: { assignedUser: { select: { id: true, name: true } } },
    });
    if (!card) return NextResponse.json({ error: "No passport with that number." }, { status: 404 });
    await db.ticket.update({
      where: { id: ticket.id },
      data: {
        rfidCardId: card.id,
        holderUserId: card.assignedUserId,
        holderName: name || card.assignedUser?.name || null,
        holderNic: null,
      },
    });
    return NextResponse.json({ ok: true, holder: name || card.assignedUser?.name || card.passportNo });
  }

  // NIC path: find the friend by their stored NIC/passport id number (optional).
  const friend = await db.user.findFirst({ where: { idNumber: nic }, select: { id: true, name: true } });
  await db.ticket.update({
    where: { id: ticket.id },
    data: {
      holderUserId: friend?.id ?? null,
      holderName: name || friend?.name || null,
      holderNic: nic,
      // Friend has no passport linked here; they enter via printed code/NIC at gate.
      rfidCardId: friend ? undefined : null,
    },
  });
  return NextResponse.json({ ok: true, holder: name || friend?.name || nic });
}
