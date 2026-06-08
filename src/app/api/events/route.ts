import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createEventForUser, EventCreateError } from "@/lib/event-create";
import { UserRole, isCreatorRole } from "@/lib/types";

const schema = z.object({
  title: z.string().trim().min(2).max(160),
  shortDescription: z.string().trim().max(240).optional().or(z.literal("")),
  description: z.string().trim().min(1).max(8000),
  categoryId: z.string().min(1),
  currency: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
  organizationId: z.string().optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  salesThreshold: z.number().int().min(0).optional(),
  existingVenueId: z.string().optional(),
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
  images: z.array(z.string().url()).max(12).optional(),
  primaryIndex: z.number().int().min(0).optional(),
  packages: z
    .array(
      z.object({
        name: z.string().trim().max(120),
        price: z.number().min(0),
        qtyTotal: z.number().int().min(0),
        perks: z.string().max(500).optional().or(z.literal("")),
      })
    )
    .min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  if (!isCreatorRole(session.role) && session.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ error: "Only organizers can publish shows." }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid event data." },
      { status: 400 }
    );
  }

  try {
    const event = await createEventForUser(session, {
      ...parsed.data,
      shortDescription: parsed.data.shortDescription || undefined,
    });
    return NextResponse.json({ ok: true, eventId: event.id, slug: event.slug });
  } catch (err) {
    if (err instanceof EventCreateError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Event create failed", err);
    return NextResponse.json({ error: "Could not create the event. Please try again." }, { status: 500 });
  }
}
