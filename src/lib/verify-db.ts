// ============================================================
// VERIFICATION-PLANE Prisma client (ISOLATED from core `db`)
// ============================================================
// This client connects to the SEPARATE verification database via
// VERIFY_DATABASE_URL using a least-privilege role that has NO access to the
// core `public` schema (orders / events / tickets / financials).
//
// SECURITY CONTRACT:
//   * Partner-edge code (/api/v1/*) and the verification libs import ONLY this
//     client. They must NEVER import `@/lib/db` (the full-access core client).
//   * Conversely, the core one-way sync writes here through `verifyDb`, but the
//     verification plane never reads back into core.
import { PrismaClient } from "@/generated/verify-client";

const globalForVerify = globalThis as unknown as { verifyPrisma?: PrismaClient };

export const verifyDb =
  globalForVerify.verifyPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForVerify.verifyPrisma = verifyDb;

/**
 * Guard for production: fail loudly if the verification plane is pointed at the
 * same connection string as the core database, which would defeat isolation.
 */
export function assertVerifyIsolation(): void {
  const core = process.env.DATABASE_URL;
  const verify = process.env.VERIFY_DATABASE_URL;
  if (!verify) throw new Error("VERIFY_DATABASE_URL is not set.");
  if (process.env.NODE_ENV === "production" && core && core === verify) {
    throw new Error(
      "Verification plane shares the core DATABASE_URL - isolation broken. Point VERIFY_DATABASE_URL at a dedicated database."
    );
  }
}
