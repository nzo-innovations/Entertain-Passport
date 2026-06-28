import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateIdentity } from "@/lib/identity";

const schema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  idType: z.enum(["NIC", "PASSPORT"]).optional().default("NIC"),
  idNumber: z.string().trim().min(1).max(40).optional(),
  nic: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional().or(z.literal("")),
  birthday: z.string().optional().or(z.literal("")),
  address: z
    .object({
      line1: z.string().trim().max(160).optional().or(z.literal("")),
      line2: z.string().trim().max(160).optional().or(z.literal("")),
      city: z.string().trim().max(120).optional().or(z.literal("")),
      district: z.string().trim().max(120).optional().or(z.literal("")),
      province: z.string().trim().max(120).optional().or(z.literal("")),
      country: z.string().trim().max(120).optional().or(z.literal("")),
      zip: z.string().trim().max(20).optional().or(z.literal("")),
    })
    .optional(),
});

const clean = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile data." }, { status: 400 });
  }
  const d = parsed.data;
  const identityCheck = validateIdentity(d.idType, d.idNumber || d.nic || "");
  if (!identityCheck.ok) {
    return NextResponse.json(
      { error: identityCheck.error ?? "Enter a valid identity number." },
      { status: 400 }
    );
  }

  try {
    await db.user.update({
      where: { id: session.id },
      data: {
        firstName: d.firstName.trim(),
        lastName: d.lastName.trim(),
        name: `${d.firstName.trim()} ${d.lastName.trim()}`,
        nic: d.idType === "NIC" ? identityCheck.normalized : null,
        phone: clean(d.phone),
        gender: clean(d.gender),
        birthday: d.birthday ? new Date(d.birthday) : null,
        idType: d.idType,
        idNumber: identityCheck.normalized,
      },
    });

    const a = d.address;
    const hasAddress = a && (a.line1 || a.city || a.district || a.province);
    if (hasAddress) {
      const existing = await db.address.findFirst({
        where: { userId: session.id },
        orderBy: { isPrimary: "desc" },
      });
      const addressData = {
        line1: a!.line1?.trim() || "",
        line2: clean(a!.line2),
        city: a!.city?.trim() || "",
        district: clean(a!.district),
        province: clean(a!.province),
        country: a!.country?.trim() || "Sri Lanka",
        zip: clean(a!.zip),
      };
      if (existing) {
        await db.address.update({ where: { id: existing.id }, data: addressData });
      } else {
        await db.address.create({ data: { ...addressData, userId: session.id, isPrimary: true } });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "That NIC, passport number or phone number is already linked to another account." },
        { status: 409 }
      );
    }
    console.error("Profile update failed", err);
    return NextResponse.json({ error: "Could not save your profile. Please try again." }, { status: 500 });
  }
}
