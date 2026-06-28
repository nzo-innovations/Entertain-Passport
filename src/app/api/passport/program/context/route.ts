import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { lookupPassportAssigneeContext } from "@/lib/passport/passport-test-service";

const schema = z.object({
  publicPassportNumber: z.string().min(10),
});

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid passport number." }, { status: 400 });
  }

  const context = await lookupPassportAssigneeContext(parsed.data.publicPassportNumber);
  return NextResponse.json(context);
}
