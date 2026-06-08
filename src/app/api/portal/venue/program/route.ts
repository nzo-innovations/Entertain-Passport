import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageOrgVenue, canManageVenue, getOrgVenueForUser } from "@/lib/venues";
import { ActType, ProgramRecurrence } from "@/lib/types";

const programSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  performerName: z.string().trim().max(120).optional(),
  actType: z.enum([ActType.SOLO, ActType.TRIO, ActType.FULL_BAND, ActType.DJ, ActType.OTHER]),
  recurrence: z.enum([ProgramRecurrence.WEEKLY, ProgramRecurrence.ONE_OFF]),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  specificDate: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  isPublished: z.boolean().optional(),
});

async function requireVenue(sessionId: string) {
  const row = await getOrgVenueForUser(sessionId);
  if (!row?.venue) return null;
  return row.venue;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageOrgVenue(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const venue = await requireVenue(session.id);
  if (!venue) return NextResponse.json({ programs: [] });

  const programs = await db.venueProgram.findMany({
    where: { venueId: venue.id },
    orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json({ programs });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageOrgVenue(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const venue = await requireVenue(session.id);
  if (!venue) {
    return NextResponse.json({ error: "Save your venue profile first." }, { status: 400 });
  }
  if (!(await canManageVenue(session.id, venue.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = programSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the program details." }, { status: 400 });
  }

  const data = parsed.data;
  if (data.recurrence === ProgramRecurrence.WEEKLY && data.dayOfWeek === undefined) {
    return NextResponse.json({ error: "Pick a day of the week for weekly programs." }, { status: 400 });
  }
  if (data.recurrence === ProgramRecurrence.ONE_OFF && !data.specificDate) {
    return NextResponse.json({ error: "Pick a date for one-off programs." }, { status: 400 });
  }

  const program = await db.venueProgram.create({
    data: {
      venueId: venue.id,
      title: data.title,
      description: data.description || null,
      performerName: data.performerName || null,
      actType: data.actType,
      recurrence: data.recurrence,
      dayOfWeek: data.recurrence === ProgramRecurrence.WEEKLY ? data.dayOfWeek! : null,
      specificDate:
        data.recurrence === ProgramRecurrence.ONE_OFF && data.specificDate
          ? new Date(`${data.specificDate}T12:00:00`)
          : null,
      startTime: data.startTime,
      endTime: data.endTime || null,
      isPublished: data.isPublished ?? true,
    },
  });

  return NextResponse.json({ program });
}
