import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { canManageEvent } from "@/lib/permissions";
import { updatePhysicalConfig, PhysicalTicketError } from "@/lib/physical-tickets";
import { PhysicalCodeCharset } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean(),
  length: z.number().int().min(1).max(32).nullable().optional(),
  charset: z.enum([PhysicalCodeCharset.NUMERIC, PhysicalCodeCharset.ALPHANUMERIC]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only event managers / org admins / Super Admin may toggle the feature or
  // change the code format - not plain gate staff.
  if (!(await canManageEvent(session.id, params.id, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await updatePhysicalConfig(params.id, {
      enabled: parsed.data.enabled,
      length: parsed.data.length ?? null,
      charset: parsed.data.charset,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PhysicalTicketError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't update settings." }, { status: 500 });
  }
}
