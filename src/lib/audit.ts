import { db } from "./db";

/**
 * Records an entry in the AuditLog. Best-effort: a logging failure should never
 * break the underlying admin action, so errors are swallowed (and logged to the
 * server console).
 */
export async function logAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  diff?: unknown
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        diffJson: diff ? JSON.stringify(diff) : null,
      },
    });
  } catch (err) {
    console.error("Audit log write failed", err);
  }
}
