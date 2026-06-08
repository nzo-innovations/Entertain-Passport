import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(120),
  district: z.string().trim().max(120).optional().or(z.literal("")),
  province: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  mapUrl: z.string().trim().max(500).optional().or(z.literal("")),
  capacity: z.number().int().min(0).max(1_000_000).optional(),
});

const clean = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid venue data." }, { status: 400 });
  }
  const d = parsed.data;

  const venue = await db.venue.create({
    data: {
      name: d.name,
      address: d.address,
      line2: clean(d.line2),
      city: d.city,
      district: clean(d.district),
      province: clean(d.province),
      country: d.country?.trim() || "Sri Lanka",
      mapUrl: clean(d.mapUrl),
      capacity: d.capacity ?? 0,
    },
  });
  await logAudit(admin.id, "CREATE", "Venue", venue.id, { name: venue.name });

  return NextResponse.json({ ok: true, venue });
}
