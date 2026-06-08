import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { canManageEvent } from "@/lib/permissions";
import { updateEventForUser, deleteEvent, EventUpdateError } from "@/lib/event-update";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  title: z.string().trim().min(2).max(160),
  shortDescription: z.string().trim().max(240).optional().or(z.literal("")),
  description: z.string().trim().min(1).max(8000),
  categoryId: z.string().min(1),
  currency: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
  salesThreshold: z.number().int().min(0).nullable().optional(),
  status: z.string().optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  venue: z.object({
    name: z.string().trim().min(1).max(160),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional().or(z.literal("")),
    city: z.string().trim().min(1).max(120),
    district: z.string().trim().max(120).optional().or(z.literal("")),
    province: z.string().trim().max(120).optional().or(z.literal("")),
    country: z.string().trim().max(120).optional().or(z.literal("")),
    mapUrl: z.string().trim().max(500).optional().or(z.literal("")),
    capacity: z.number().int().min(0).optional(),
  }),
  packages: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().max(120),
        price: z.number().min(0),
        qtyTotal: z.number().int().min(0),
        perks: z.string().max(500).optional().or(z.literal("")),
      })
    )
    .min(1),
  images: z.array(z.string().url()).max(12).optional(),
  primaryIndex: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const allowed = await canManageEvent(session.id, params.id, session.role);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid event data." },
      { status: 400 }
    );
  }

  try {
    const event = await updateEventForUser(session, params.id, {
      ...parsed.data,
      shortDescription: parsed.data.shortDescription || undefined,
    });
    await logAudit(session.id, "UPDATE", "Event", params.id, { title: parsed.data.title });
    if (parsed.data.images !== undefined) revalidateTag("events");
    return NextResponse.json({ ok: true, slug: event?.slug });
  } catch (err) {
    if (err instanceof EventUpdateError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Event update failed", err);
    return NextResponse.json({ error: "Could not update the event." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const allowed = await canManageEvent(session.id, params.id, session.role);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await deleteEvent(params.id);
    await logAudit(session.id, "DELETE", "Event", params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof EventUpdateError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Event delete failed", err);
    return NextResponse.json({ error: "Could not delete the event." }, { status: 500 });
  }
}
