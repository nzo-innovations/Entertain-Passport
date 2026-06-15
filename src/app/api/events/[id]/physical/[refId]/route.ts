import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { canManagePhysicalTickets } from "@/lib/permissions";
import {
  deletePhysicalTicket,
  updatePhysicalTicket,
  PhysicalTicketError,
} from "@/lib/physical-tickets";
import { PhysicalTicketStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  refCode: z.string().min(1).max(64).optional(),
  status: z
    .enum([PhysicalTicketStatus.AVAILABLE, PhysicalTicketStatus.SOLD, PhysicalTicketStatus.VOID])
    .optional(),
  note: z.string().max(280).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; refId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManagePhysicalTickets(session.id, params.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await updatePhysicalTicket(params.id, params.refId, parsed.data, session.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PhysicalTicketError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't update the ticket." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; refId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManagePhysicalTickets(session.id, params.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deletePhysicalTicket(params.id, params.refId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PhysicalTicketError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't delete the ticket." }, { status: 500 });
  }
}
