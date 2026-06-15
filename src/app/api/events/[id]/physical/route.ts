import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { canManagePhysicalTickets } from "@/lib/permissions";
import { db } from "@/lib/db";
import {
  addPhysicalTicketRange,
  addSinglePhysicalTicket,
  getPhysicalMismatches,
  listPhysicalTickets,
  PhysicalTicketError,
} from "@/lib/physical-tickets";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManagePhysicalTickets(session.id, params.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const packageId = url.searchParams.get("packageId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  const event = await db.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      currency: true,
      status: true,
      approvalStatus: true,
      physicalTicketsEnabled: true,
      physicalCodeLength: true,
      physicalCodeCharset: true,
      venue: { select: { name: true } },
      organization: { select: { name: true } },
      startsAt: true,
      packages: {
        select: { id: true, name: true, price: true, qtyTotal: true, qtySold: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const [tickets, mismatches] = await Promise.all([
    listPhysicalTickets(params.id, { packageId, status, q }),
    getPhysicalMismatches(params.id),
  ]);

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      currency: event.currency,
      status: event.status,
      approvalStatus: event.approvalStatus,
      physicalTicketsEnabled: event.physicalTicketsEnabled,
      physicalCodeLength: event.physicalCodeLength,
      physicalCodeCharset: event.physicalCodeCharset,
      venueName: event.venue.name,
      organizationName: event.organization.name,
      startsAt: event.startsAt.toISOString(),
    },
    packages: event.packages.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      qtyTotal: p.qtyTotal,
      qtySold: p.qtySold,
    })),
    mismatches,
    tickets,
  });
}

const postSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("single"),
    packageId: z.string().min(1),
    refCode: z.string().min(1).max(64),
  }),
  z.object({
    mode: z.literal("range"),
    packageId: z.string().min(1),
    start: z.string().min(1).max(64),
    end: z.string().min(1).max(64),
  }),
]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManagePhysicalTickets(session.id, params.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    if (parsed.data.mode === "single") {
      await addSinglePhysicalTicket(params.id, parsed.data.packageId, parsed.data.refCode);
      return NextResponse.json({ ok: true, added: 1 });
    }
    const result = await addPhysicalTicketRange(
      params.id,
      parsed.data.packageId,
      parsed.data.start,
      parsed.data.end
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof PhysicalTicketError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't add ticket codes." }, { status: 500 });
  }
}
