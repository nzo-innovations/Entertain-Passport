import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { validatePublicPassportNumber } from "./passport-number-generator";
import { generateSecurePublicPassportNumber } from "./passport-serial-engine";
import type { PassportCardTypeCode } from "./types";

export { compactPublicNumber, formatPublicPassportNumber } from "./passport-number-generator";

const MAX_BATCH = 5000;

export async function generatePassportBatch(args: {
  batchCode: string;
  cardType: PassportCardTypeCode;
  issueYear: number;
  quantity: number;
  generatedById: string;
  initialStatus?: "GENERATED" | "AVAILABLE";
}): Promise<{ batchId: string; created: number }> {
  if (args.quantity < 1 || args.quantity > MAX_BATCH) {
    throw new Error(`Quantity must be between 1 and ${MAX_BATCH}.`);
  }

  const existing = await db.passportBatch.findUnique({ where: { batchCode: args.batchCode } });
  if (existing) throw new Error("Batch code already exists.");

  const batch = await db.passportBatch.create({
    data: {
      batchCode: args.batchCode.trim(),
      cardType: args.cardType,
      issueYear: args.issueYear,
      quantity: args.quantity,
      generatedById: args.generatedById,
      status: "GENERATED",
    },
  });

  const status = args.initialStatus ?? "GENERATED";
  const seen = new Set<string>();
  const rows: Array<{
    publicPassportNumber: string;
    formattedPassportNumber: string;
    internalPassportUuid: string;
    cardType: string;
    issueYear: number;
    status: string;
    batchId: string;
  }> = [];

  let attempts = 0;
  while (rows.length < args.quantity && attempts < args.quantity * 50) {
    attempts++;
    const internalPassportUuid = randomUUID();
    const { compact, formatted } = generateSecurePublicPassportNumber({
      issueYear: args.issueYear,
      cardType: args.cardType,
      batchCode: batch.batchCode,
      batchId: batch.id,
      sequence: rows.length,
      internalPassportUuid,
    });
    if (seen.has(compact)) continue;
    seen.add(compact);
    rows.push({
      publicPassportNumber: compact,
      formattedPassportNumber: formatted,
      internalPassportUuid,
      cardType: args.cardType,
      issueYear: args.issueYear,
      status,
      batchId: batch.id,
    });
  }

  if (rows.length < args.quantity) {
    throw new Error("Could not generate enough unique passport numbers.");
  }

  await db.passportNumberInventory.createMany({ data: rows, skipDuplicates: true });

  await logAudit(args.generatedById, "CREATE", "PassportBatch", batch.id, {
    batchCode: batch.batchCode,
    quantity: args.quantity,
    cardType: args.cardType,
  });

  return { batchId: batch.id, created: rows.length };
}

export async function listPassportBatches() {
  return db.passportBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      generatedBy: { select: { name: true, email: true } },
      _count: { select: { inventory: true } },
    },
  });
}

export async function listPassportInventory(filters: {
  status?: string;
  batchId?: string;
  cardType?: string;
  q?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, filters.limit ?? 50);
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.batchId) where.batchId = filters.batchId;
  if (filters.cardType) where.cardType = filters.cardType;
  if (filters.q?.trim()) {
    const q = filters.q.replace(/\s/g, "");
    where.OR = [
      { publicPassportNumber: { contains: q } },
      { formattedPassportNumber: { contains: filters.q.trim() } },
      { internalPassportUuid: { contains: filters.q.trim() } },
    ];
  }

  const [items, total] = await Promise.all([
    db.passportNumberInventory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        batch: { select: { batchCode: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    }),
    db.passportNumberInventory.count({ where }),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) };
}

export async function markBatchAvailable(batchId: string, actorId: string) {
  const result = await db.passportNumberInventory.updateMany({
    where: { batchId, status: { in: ["GENERATED", "PRINTED"] } },
    data: { status: "AVAILABLE" },
  });
  await logAudit(actorId, "UPDATE", "PassportBatch", batchId, { action: "mark_available", count: result.count });
  return result.count;
}

export async function exportPrintBatch(batchId: string): Promise<string> {
  const batch = await db.passportBatch.findUnique({
    where: { id: batchId },
    include: {
      inventory: {
        orderBy: { publicPassportNumber: "asc" },
        select: {
          formattedPassportNumber: true,
          publicPassportNumber: true,
          cardType: true,
          internalPassportUuid: true,
        },
      },
    },
  });
  if (!batch) throw new Error("Batch not found.");

  const header = "formattedPassportNumber,publicPassportNumber,cardType,batchCode,internalPassportUuid";
  const lines = batch.inventory.map(
    (r) =>
      `"${r.formattedPassportNumber}","${r.publicPassportNumber}","${r.cardType}","${batch.batchCode}","${r.internalPassportUuid}"`
  );
  return [header, ...lines].join("\n");
}

export function resolvePublicNumberInput(input: string) {
  return validatePublicPassportNumber(input);
}
