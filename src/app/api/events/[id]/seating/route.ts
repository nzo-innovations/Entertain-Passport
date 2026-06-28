import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageEvent } from "@/lib/permissions";
import {
  ensureEventSeatMap,
  publishEventSeatMap,
  updateEventSeatMapLayout,
} from "@/lib/seating/event-seat-map-service";
import { getLayoutTemplate } from "@/lib/seating/template-service";
import { normalizeLayout, parseLayoutJson } from "@/lib/seating/layout-utils";
import type { SeatLayoutDocument } from "@/lib/seating/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await canManageEvent(session.id, params.id, session.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const map = await ensureEventSeatMap(params.id);
    return NextResponse.json({
      seating: {
        id: map.id,
        seatingEnabled: map.seatingEnabled,
        published: map.published,
        publishedAt: map.publishedAt?.toISOString() ?? null,
        templateId: map.templateId,
        layout: parseLayoutJson(map.layoutJson),
      },
    });
  } catch (err) {
    console.error("[seating GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load seating" },
      { status: 500 }
    );
  }
}

const updateSchema = z.object({
  seatingEnabled: z.boolean().optional(),
  templateId: z.string().optional(),
  layout: z.custom<SeatLayoutDocument>().optional(),
  publish: z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await canManageEvent(session.id, params.id, session.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid seating data." }, { status: 400 });
    }

    let layout = parsed.data.layout ? normalizeLayout(parsed.data.layout) : undefined;

    if (parsed.data.templateId && !layout) {
      const tpl = await getLayoutTemplate(parsed.data.templateId);
      if (!tpl) return NextResponse.json({ error: "Template not found." }, { status: 404 });
      layout = parseLayoutJson(tpl.layoutJson);
    }

    if (layout) {
      await updateEventSeatMapLayout(params.id, layout, {
        seatingEnabled: parsed.data.seatingEnabled,
      });
      if (parsed.data.templateId) {
        await db.eventSeatMap.update({
          where: { eventId: params.id },
          data: { templateId: parsed.data.templateId },
        });
      }
    } else if (parsed.data.seatingEnabled !== undefined) {
      const map = await ensureEventSeatMap(params.id);
      await updateEventSeatMapLayout(params.id, parseLayoutJson(map.layoutJson), {
        seatingEnabled: parsed.data.seatingEnabled,
      });
    }

    if (parsed.data.publish) {
      try {
        await publishEventSeatMap(params.id);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Publish failed" },
          { status: 400 }
        );
      }
    }

    const map = await ensureEventSeatMap(params.id);
    return NextResponse.json({
      ok: true,
      seating: {
        seatingEnabled: map.seatingEnabled,
        published: map.published,
        layout: parseLayoutJson(map.layoutJson),
      },
    });
  } catch (err) {
    console.error("[seating PUT]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save seating" },
      { status: 500 }
    );
  }
}
