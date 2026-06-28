import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { lookupPassportForAssign, lookupUserForAssign } from "@/lib/passport/passport-assignment-service";

const schema = z.object({
  publicPassportNumber: z.string().optional(),
  primaryIdType: z.enum(["NIC", "PASSPORT"]).optional(),
  primaryIdValue: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid validate payload." }, { status: 400 });
  }

  const [passport, user] = await Promise.all([
    parsed.data.publicPassportNumber != null
      ? lookupPassportForAssign(parsed.data.publicPassportNumber)
      : Promise.resolve(null),
    parsed.data.primaryIdType && parsed.data.primaryIdValue != null
      ? lookupUserForAssign(parsed.data.primaryIdType, parsed.data.primaryIdValue)
      : Promise.resolve(null),
  ]);

  return NextResponse.json({ passport, user });
}
