import { db } from "./db";
import { getSupabaseAdmin } from "./supabase/admin";
import { logAudit } from "./audit";
import { OrgMemberRole, UserRole } from "./types";

export class GateStaffServiceError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "GateStaffServiceError";
  }
}

export async function createGateStaffAccount({
  organizationId,
  name,
  email,
  password,
  actorId,
}: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
  actorId: string;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new GateStaffServiceError(
      "Gate-staff account creation is not configured. Set SUPABASE_SERVICE_ROLE_KEY.",
      501
    );
  }

  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new GateStaffServiceError("Organization not found.", 404);

  const existing = await db.user.findUnique({ where: { email } });
  let userId: string;

  if (existing) {
    if (existing.role !== UserRole.GATE_STAFF) {
      throw new GateStaffServiceError("That email belongs to a non gate-staff account.", 409);
    }
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: UserRole.GATE_STAFF },
    });
    if (error || !data.user) {
      throw new GateStaffServiceError(error?.message ?? "Could not create account.");
    }
    userId = data.user.id;
  }

  await db.user.upsert({
    where: { id: userId },
    create: { id: userId, email, name, role: UserRole.GATE_STAFF },
    update: { name, role: UserRole.GATE_STAFF },
  });

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: { organizationId, userId, role: OrgMemberRole.WORKER },
    update: {},
  });

  await logAudit(actorId, "CREATE", "GateStaff", userId, { orgId: organizationId, email });

  return { userId, name, email, organizationId };
}

export async function updateGateStaffAccount({
  userId,
  name,
  password,
  actorId,
  orgId,
}: {
  userId: string;
  name?: string;
  password?: string;
  actorId: string;
  orgId?: string;
}) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== UserRole.GATE_STAFF) {
    throw new GateStaffServiceError("Gate staff account not found.", 404);
  }

  if (name) {
    await db.user.update({ where: { id: userId }, data: { name } });
  }

  if (name || password) {
    const admin = getSupabaseAdmin();
    if (admin) {
      await admin.auth.admin.updateUserById(userId, {
        ...(password ? { password } : {}),
        ...(name ? { user_metadata: { name, role: UserRole.GATE_STAFF } } : {}),
      });
    } else if (password) {
      throw new GateStaffServiceError("Password reset needs SUPABASE_SERVICE_ROLE_KEY configured.", 501);
    }
  }

  await logAudit(actorId, "UPDATE", "GateStaff", userId, orgId ? { orgId } : undefined);
}

export async function deleteGateStaffAccount({
  userId,
  organizationId,
  actorId,
  removeEntireAccount = true,
}: {
  userId: string;
  organizationId?: string;
  actorId: string;
  removeEntireAccount?: boolean;
}) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== UserRole.GATE_STAFF) {
    throw new GateStaffServiceError("Gate staff account not found.", 404);
  }

  if (organizationId) {
    await db.eventStaff.deleteMany({
      where: { userId, event: { organizationId } },
    });
    await db.organizationMember.delete({
      where: { organizationId_userId: { organizationId, userId } },
    });
  } else if (removeEntireAccount) {
    await db.eventStaff.deleteMany({ where: { userId } });
    await db.organizationMember.deleteMany({ where: { userId } });

    const admin = getSupabaseAdmin();
    if (admin) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }
  }

  await logAudit(actorId, "DELETE", "GateStaff", userId, organizationId ? { orgId: organizationId } : undefined);
}

export async function listAllGateStaff() {
  const members = await db.organizationMember.findMany({
    where: { user: { role: UserRole.GATE_STAFF } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, name: true } },
    },
    orderBy: [{ organization: { name: "asc" } }, { createdAt: "asc" }],
  });

  const userIds = [...new Set(members.map((m) => m.user.id))];
  const assignments = userIds.length
    ? await db.eventStaff.findMany({
        where: { userId: { in: userIds } },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              organizationId: true,
              organization: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const byUser = new Map<
    string,
    {
      userId: string;
      name: string | null;
      email: string;
      organizations: { id: string; name: string }[];
      assignments: {
        staffId: string;
        eventId: string;
        eventTitle: string;
        organizationId: string;
        organizationName: string;
        role: string;
      }[];
    }
  >();

  for (const m of members) {
    const existing = byUser.get(m.user.id) ?? {
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      organizations: [],
      assignments: [],
    };
    if (!existing.organizations.some((o) => o.id === m.organization.id)) {
      existing.organizations.push({ id: m.organization.id, name: m.organization.name });
    }
    byUser.set(m.user.id, existing);
  }

  for (const a of assignments) {
    const row = byUser.get(a.userId);
    if (!row) continue;
    row.assignments.push({
      staffId: a.id,
      eventId: a.event.id,
      eventTitle: a.event.title,
      organizationId: a.event.organizationId,
      organizationName: a.event.organization.name,
      role: a.role,
    });
  }

  return [...byUser.values()];
}
