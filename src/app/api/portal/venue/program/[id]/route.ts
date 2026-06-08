import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageOrgVenue, canManageVenue } from "@/lib/venues";
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

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageOrgVenue(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.venueProgram.findUnique({
    where: { id: params.id },
    include: { venue: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManageVenue(session.id, existing.venueId, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = programSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the program details." }, { status: 400 });
  }

  const data = parsed.data;
  const program = await db.venueProgram.update({
    where: { id: params.id },
    data: {
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

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageOrgVenue(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.venueProgram.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManageVenue(session.id, existing.venueId, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.venueProgram.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
