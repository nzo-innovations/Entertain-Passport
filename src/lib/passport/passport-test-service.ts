import { db } from "@/lib/db";
import { verifyTagSignature } from "@/lib/nfc/crypto-service";
import { profileIdentityDisplay } from "@/lib/profile";
import { compactPublicNumber, resolvePublicNumberInput } from "./passport-inventory-service";
import { verifyTagSignatureV2 } from "./crypto-service";
import { PASSPORT_CARD_TYPE_LABELS } from "./types";

export type CardTestCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
};

export type CardTestOwner = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  identity: string | null;
  assignedAt: string | null;
};

export type CardTestEventTicket = {
  ticketId: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  eventEndsAt: string;
  venueName: string;
  packageName: string;
  status: string;
  holderName: string | null;
  isBuyer: boolean;
  linkedToCard: boolean;
  orderId: string;
  purchasedAt: string;
};

export type ProgrammedCardTestResult = {
  verdict: "PASS" | "FAIL";
  summary: string;
  checks: CardTestCheck[];
  card?: {
    formattedPassportNumber: string;
    publicPassportNumber: string;
    cardType: string;
    cardTypeLabel: string;
    status: string;
    internalPassportUuid: string;
    nfcUid: string | null;
    registeredUid: string | null;
    programmedAt: string | null;
    keyVersion: number | null;
    counterOnChip: number | null;
    counterRegistered: number | null;
    holderName: string | null;
    holderEmail: string | null;
    batchCode: string | null;
    signatureValid: boolean;
    uidMatch: boolean;
  };
  owner?: CardTestOwner | null;
  eventTickets?: CardTestEventTicket[];
};

type V2Input = {
  internalPassportUuid: string;
  publicPassportNumber: string;
  nfcUid: string;
  keyVersion: number;
  issuedAt: string;
  counter: number;
  signature: string;
};

type LegacyInput = {
  passportId: string;
  cardUid: string;
  keyVersion: number;
  issuedAt: string;
  counter: number;
  signature: string;
};

function buildCardDetails(
  inventory: {
    formattedPassportNumber: string;
    publicPassportNumber: string;
    cardType: string;
    status: string;
    internalPassportUuid: string;
    batch?: { batchCode: string } | null;
    assignedUser?: { name: string | null; email: string } | null;
  },
  extras: {
    nfcUid: string;
    registeredUid: string | null;
    programmedAt: string | null;
    keyVersion: number;
    counterOnChip: number;
    counterRegistered: number | null;
    signatureValid: boolean;
    uidMatch: boolean;
  }
): NonNullable<ProgrammedCardTestResult["card"]> {
  return {
    formattedPassportNumber: inventory.formattedPassportNumber,
    publicPassportNumber: inventory.publicPassportNumber,
    cardType: inventory.cardType,
    cardTypeLabel: PASSPORT_CARD_TYPE_LABELS[inventory.cardType] ?? inventory.cardType,
    status: inventory.status,
    internalPassportUuid: inventory.internalPassportUuid,
    nfcUid: extras.nfcUid,
    registeredUid: extras.registeredUid,
    programmedAt: extras.programmedAt,
    keyVersion: extras.keyVersion,
    counterOnChip: extras.counterOnChip,
    counterRegistered: extras.counterRegistered,
    holderName: inventory.assignedUser?.name ?? null,
    holderEmail: inventory.assignedUser?.email ?? null,
    batchCode: inventory.batch?.batchCode ?? null,
    signatureValid: extras.signatureValid,
    uidMatch: extras.uidMatch,
  };
}

function finalize(
  checks: CardTestCheck[],
  card?: ProgrammedCardTestResult["card"],
  context?: { owner?: CardTestOwner | null; eventTickets?: CardTestEventTicket[] }
): ProgrammedCardTestResult {
  const allPass = checks.every((c) => c.pass);
  const firstFail = checks.find((c) => !c.pass);
  return {
    verdict: allPass ? "PASS" : "FAIL",
    summary: allPass
      ? "Card passed all programming checks - ready for gate use."
      : (firstFail?.detail ?? firstFail?.label ?? "One or more checks failed."),
    checks,
    card,
    owner: context?.owner ?? null,
    eventTickets: context?.eventTickets ?? [],
  };
}

const ONGOING_EVENT_STATUSES = ["PUBLISHED", "SOLD_OUT"] as const;

async function loadOwnerContext(args: {
  assignedUserId: string | null | undefined;
  assignedAt: Date | null | undefined;
  rfidCardId: string | null | undefined;
}): Promise<{ owner: CardTestOwner | null; eventTickets: CardTestEventTicket[] }> {
  const { assignedUserId, assignedAt, rfidCardId } = args;
  if (!assignedUserId && !rfidCardId) {
    return { owner: null, eventTickets: [] };
  }

  const ownerUser = assignedUserId
    ? await db.user.findUnique({
        where: { id: assignedUserId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          nic: true,
          idType: true,
          idNumber: true,
        },
      })
    : null;

  const owner: CardTestOwner | null = ownerUser
    ? {
        id: ownerUser.id,
        name: ownerUser.name,
        email: ownerUser.email,
        phone: ownerUser.phone,
        identity: profileIdentityDisplay(ownerUser),
        assignedAt: assignedAt?.toISOString() ?? null,
      }
    : null;

  const now = new Date();
  const ongoingEvent = {
    status: { in: [...ONGOING_EVENT_STATUSES] },
    endsAt: { gte: now },
  };

  const orFilters = [];
  if (assignedUserId) {
    orFilters.push(
      { orderItem: { order: { userId: assignedUserId }, event: ongoingEvent } },
      { holderUserId: assignedUserId, orderItem: { event: ongoingEvent } }
    );
  }
  if (rfidCardId) {
    orFilters.push({ rfidCardId, orderItem: { event: ongoingEvent } });
  }

  if (orFilters.length === 0) {
    return { owner, eventTickets: [] };
  }

  const tickets = await db.ticket.findMany({
    where: { OR: orFilters },
    include: {
      orderItem: {
        include: {
          event: { include: { venue: { select: { name: true } } } },
          package: { select: { name: true } },
          order: { select: { id: true, userId: true, createdAt: true, user: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ orderItem: { event: { startsAt: "asc" } } }, { createdAt: "asc" }],
    take: 50,
  });

  const seen = new Set<string>();
  const eventTickets: CardTestEventTicket[] = [];

  for (const ticket of tickets) {
    if (seen.has(ticket.id)) continue;
    seen.add(ticket.id);

    const event = ticket.orderItem.event;
    const buyerId = ticket.orderItem.order.userId;
    eventTickets.push({
      ticketId: ticket.id,
      eventId: event.id,
      eventTitle: event.title,
      eventStartsAt: event.startsAt.toISOString(),
      eventEndsAt: event.endsAt.toISOString(),
      venueName: event.venue.name,
      packageName: ticket.orderItem.package.name,
      status: ticket.status,
      holderName:
        ticket.holderName ??
        ticket.orderItem.order.user.name ??
        owner?.name ??
        null,
      isBuyer: assignedUserId ? buyerId === assignedUserId : false,
      linkedToCard: rfidCardId ? ticket.rfidCardId === rfidCardId : false,
      orderId: ticket.orderItem.order.id,
      purchasedAt: ticket.orderItem.order.createdAt.toISOString(),
    });
  }

  return { owner, eventTickets };
}

export type PassportAssigneeContext = {
  card: {
    formattedPassportNumber: string;
    status: string;
    cardTypeLabel: string;
    batchCode: string | null;
  } | null;
  owner: CardTestOwner | null;
  eventTickets: CardTestEventTicket[];
};

/** Owner + tickets for an inventory passport (assign / program side panels). */
export async function lookupPassportAssigneeContext(
  publicPassportNumber: string
): Promise<PassportAssigneeContext> {
  const parsed = resolvePublicNumberInput(publicPassportNumber);
  if (!parsed.ok || parsed.compact.length < 10) {
    return { card: null, owner: null, eventTickets: [] };
  }

  const inventory = await db.passportNumberInventory.findUnique({
    where: { publicPassportNumber: parsed.compact },
    include: {
      batch: { select: { batchCode: true } },
      rfidCard: { select: { id: true } },
    },
  });

  if (!inventory) {
    return { card: null, owner: null, eventTickets: [] };
  }

  const { owner, eventTickets } = await loadOwnerContext({
    assignedUserId: inventory.assignedUserId,
    assignedAt: inventory.assignedAt,
    rfidCardId: inventory.rfidCard?.id,
  });

  return {
    card: {
      formattedPassportNumber: inventory.formattedPassportNumber,
      status: inventory.status,
      cardTypeLabel: PASSPORT_CARD_TYPE_LABELS[inventory.cardType] ?? inventory.cardType,
      batchCode: inventory.batch?.batchCode ?? null,
    },
    owner,
    eventTickets,
  };
}

async function finalizeWithContext(
  checks: CardTestCheck[],
  card: ProgrammedCardTestResult["card"] | undefined,
  ctx: {
    assignedUserId: string | null | undefined;
    assignedAt: Date | null | undefined;
    rfidCardId: string | null | undefined;
  }
): Promise<ProgrammedCardTestResult> {
  const { owner, eventTickets } = await loadOwnerContext(ctx);
  return finalize(checks, card, { owner, eventTickets });
}

async function testInventoryV2(input: V2Input): Promise<ProgrammedCardTestResult> {
  const checks: CardTestCheck[] = [];
  const publicCompact = compactPublicNumber(input.publicPassportNumber);
  const nfcUidScanned = input.nfcUid.trim();

  const inventory = await db.passportNumberInventory.findUnique({
    where: { internalPassportUuid: input.internalPassportUuid },
    include: {
      batch: { select: { batchCode: true } },
      assignedUser: { select: { name: true, email: true } },
      rfidCard: { select: { id: true } },
      nfcProgramming: {
        where: { programmingStatus: "PROGRAMMED" },
        orderBy: { programmedAt: "desc" },
        take: 1,
      },
    },
  });

  checks.push({
    id: "inventory",
    label: "Passport in inventory",
    pass: !!inventory,
    detail: inventory ? inventory.formattedPassportNumber : "No record for internal UUID.",
  });

  if (!inventory) {
    return finalize(checks);
  }

  const pubMatch = inventory.publicPassportNumber === publicCompact;
  checks.push({
    id: "public_number",
    label: "Public number matches chip",
    pass: pubMatch,
    detail: pubMatch ? publicCompact : `Chip: ${publicCompact}, DB: ${inventory.publicPassportNumber}`,
  });

  const programming = inventory.nfcProgramming[0];
  const hasProgramming = !!programming && !!inventory.userPrimaryIdHash;
  const programmedAt = programming?.programmedAt;
  checks.push({
    id: "programmed",
    label: "NFC programming record",
    pass: hasProgramming,
    detail: hasProgramming && programmedAt
      ? `Programmed ${programmedAt.toISOString()}`
      : "Not programmed or missing ID hash.",
  });

  let signatureValid = false;
  if (hasProgramming) {
    signatureValid = verifyTagSignatureV2(
      {
        internalPassportUuid: input.internalPassportUuid,
        publicPassportNumber: publicCompact,
        nfcUid: programming!.nfcUid,
        keyVersion: input.keyVersion,
        issuedAt: input.issuedAt,
        counter: input.counter,
        userPrimaryIdHash: inventory.userPrimaryIdHash!,
      },
      input.signature
    );
  }
  checks.push({
    id: "signature",
    label: "HMAC signature valid",
    pass: signatureValid,
    detail: signatureValid ? `Key version ${input.keyVersion}` : "Signature verification failed.",
  });

  const registeredUid = programming?.nfcUid ?? null;
  const uidMatch =
    !!registeredUid && registeredUid.toLowerCase() === nfcUidScanned.toLowerCase();
  checks.push({
    id: "uid",
    label: "Chip UID matches registered card",
    pass: uidMatch,
    detail: uidMatch
      ? registeredUid!
      : registeredUid
        ? `Scanned: ${nfcUidScanned}, registered: ${registeredUid}`
        : "No programming record.",
  });

  const statusOk = inventory.status === "PROGRAMMED";
  checks.push({
    id: "status",
    label: "Inventory status PROGRAMMED",
    pass: statusOk,
    detail: statusOk ? "PROGRAMMED" : `Current status: ${inventory.status}`,
  });

  const counterOk = !programming || input.counter >= programming.counter;
  checks.push({
    id: "counter",
    label: "Counter (no replay)",
    pass: counterOk,
    detail: programming
      ? counterOk
        ? input.counter > programming.counter
          ? `Chip ${input.counter} ahead of DB ${programming.counter} - gate would update`
          : `Counter ${input.counter} matches`
        : `Replay: chip ${input.counter} < registered ${programming.counter}`
      : undefined,
  });

  return finalizeWithContext(
    checks,
    buildCardDetails(inventory, {
      nfcUid: nfcUidScanned,
      registeredUid,
      programmedAt: programming?.programmedAt?.toISOString() ?? null,
      keyVersion: input.keyVersion,
      counterOnChip: input.counter,
      counterRegistered: programming?.counter ?? null,
      signatureValid,
      uidMatch,
    }),
    {
      assignedUserId: inventory.assignedUserId,
      assignedAt: inventory.assignedAt,
      rfidCardId: inventory.rfidCard?.id,
    }
  );
}

async function testLegacyV1(input: LegacyInput): Promise<ProgrammedCardTestResult> {
  const checks: CardTestCheck[] = [];
  const cardUid = input.cardUid.trim().toUpperCase();

  const signatureValid = verifyTagSignature(
    {
      passportId: input.passportId,
      cardUid: input.cardUid,
      keyVersion: input.keyVersion,
      issuedAt: input.issuedAt,
      counter: input.counter,
    },
    input.signature
  );

  checks.push({
    id: "signature",
    label: "HMAC signature valid",
    pass: signatureValid,
    detail: signatureValid ? `Key version ${input.keyVersion}` : "Signature verification failed.",
  });

  const card = await db.rfidCard.findUnique({
    where: { passportId: input.passportId },
    include: {
      assignedUser: { select: { name: true, email: true } },
    },
  });

  checks.push({
    id: "registered",
    label: "NFC card registered",
    pass: !!card,
    detail: card ? card.passportNo : "No RFID card for this passport ID.",
  });

  if (!card) {
    return finalize(checks);
  }

  const uidMatch = card.uid.toUpperCase() === cardUid;
  checks.push({
    id: "uid",
    label: "Chip UID matches registered card",
    pass: uidMatch,
    detail: uidMatch ? cardUid : `Chip: ${cardUid}, registered: ${card.uid}`,
  });

  const statusOk = card.status === "ACTIVE";
  checks.push({
    id: "status",
    label: "Card status ACTIVE",
    pass: statusOk,
    detail: statusOk ? "ACTIVE" : `Current status: ${card.status}`,
  });

  const counterOk = input.counter >= card.counter;
  checks.push({
    id: "counter",
    label: "Counter (no replay)",
    pass: counterOk,
    detail: counterOk
      ? input.counter > card.counter
        ? `Chip ${input.counter} ahead of DB ${card.counter}`
        : `Counter ${input.counter} matches`
      : `Replay: chip ${input.counter} < registered ${card.counter}`,
  });

  const inventory = await db.passportNumberInventory.findUnique({
    where: { internalPassportUuid: input.passportId },
    include: {
      batch: { select: { batchCode: true } },
      assignedUser: { select: { name: true, email: true } },
    },
  });

  if (inventory) {
    checks.push({
      id: "inventory",
      label: "Passport in inventory",
      pass: true,
      detail: inventory.formattedPassportNumber,
    });
  }

  const cardDetails = inventory
    ? buildCardDetails(inventory, {
        nfcUid: cardUid,
        registeredUid: card.uid.toUpperCase(),
        programmedAt: null,
        keyVersion: input.keyVersion,
        counterOnChip: input.counter,
        counterRegistered: card.counter,
        signatureValid,
        uidMatch,
      })
    : {
        formattedPassportNumber: card.passportNo,
        publicPassportNumber: compactPublicNumber(card.passportNo),
        cardType: "-",
        cardTypeLabel: "Legacy",
        status: card.status,
        internalPassportUuid: input.passportId,
        nfcUid: cardUid,
        registeredUid: card.uid.toUpperCase(),
        programmedAt: null,
        keyVersion: input.keyVersion,
        counterOnChip: input.counter,
        counterRegistered: card.counter,
        holderName: card.assignedUser?.name ?? null,
        holderEmail: card.assignedUser?.email ?? null,
        batchCode: null,
        signatureValid,
        uidMatch,
      };

  return finalizeWithContext(checks, cardDetails, {
    assignedUserId: inventory?.assignedUserId ?? card.assignedUserId,
    assignedAt: inventory?.assignedAt ?? card.assignedAt,
    rfidCardId: card.id,
  });
}

async function findProgrammedRecordByUid(rawUid: string) {
  const trimmed = rawUid.trim();
  if (!trimmed) return null;

  const programming = await db.nfcCardProgramming.findFirst({
    where: {
      programmingStatus: "PROGRAMMED",
      nfcUid: { equals: trimmed, mode: "insensitive" },
    },
    orderBy: { programmedAt: "desc" },
    include: {
      inventory: {
        include: {
          batch: { select: { batchCode: true } },
          assignedUser: { select: { name: true, email: true } },
          rfidCard: { select: { id: true, issuedAt: true } },
        },
      },
    },
  });
  if (programming) return programming;

  const card = await db.rfidCard.findFirst({
    where: { uid: { equals: trimmed, mode: "insensitive" } },
    include: {
      inventory: {
        include: {
          batch: { select: { batchCode: true } },
          assignedUser: { select: { name: true, email: true } },
          rfidCard: { select: { id: true, issuedAt: true } },
        },
      },
    },
  });
  if (!card?.inventory) return null;

  return db.nfcCardProgramming.findFirst({
    where: {
      inventoryId: card.inventory.id,
      programmingStatus: "PROGRAMMED",
    },
    orderBy: { programmedAt: "desc" },
    include: {
      inventory: {
        include: {
          batch: { select: { batchCode: true } },
          assignedUser: { select: { name: true, email: true } },
          rfidCard: { select: { id: true, issuedAt: true } },
        },
      },
    },
  });
}

/** QA when keyboard wedge sends chip UID only (no tag JSON on the reader). */
export async function testProgrammedCardByUid(rawUid: string): Promise<ProgrammedCardTestResult> {
  const scanned = rawUid.trim();
  const programming = await findProgrammedRecordByUid(scanned);

  if (!programming?.signature) {
    const checks: CardTestCheck[] = [
      {
        id: "read_mode",
        label: "Reader sent chip UID",
        pass: true,
        detail: `UID ${scanned} - keyboard wedge mode (no tag JSON).`,
      },
      {
        id: "uid_lookup",
        label: "UID registered in system",
        pass: false,
        detail: programming
          ? "Programming record found but signature missing."
          : `No programmed card found for UID ${scanned}.`,
      },
    ];
    return finalize(checks);
  }

  const inventory = programming.inventory;
  const issuedAt = inventory.rfidCard?.issuedAt ?? programming.programmedAt ?? new Date();

  const result = await testInventoryV2({
    internalPassportUuid: programming.internalPassportUuid,
    publicPassportNumber: programming.publicPassportNumber,
    nfcUid: scanned,
    keyVersion: programming.keyVersion,
    issuedAt: issuedAt.toISOString(),
    counter: programming.counter,
    signature: programming.signature,
  });

  return {
    ...result,
    checks: [
      {
        id: "read_mode",
        label: "Reader data",
        pass: true,
        detail: `UID ${scanned} matched database record. Tag JSON was not read from chip.`,
      },
      ...result.checks,
    ],
  };
}

/** Admin QA - verify programmed NFC payload without gate check-in or event context. */
export async function testProgrammedNfcPayload(
  body: Record<string, unknown>
): Promise<ProgrammedCardTestResult> {
  const uidOnly =
    typeof body.nfcUid === "string" &&
    body.nfcUid.trim().length >= 4 &&
    typeof body.signature !== "string" &&
    typeof body.internalPassportUuid !== "string" &&
    typeof body.passportId !== "string";

  if (uidOnly) {
    return testProgrammedCardByUid(body.nfcUid as string);
  }

  if (typeof body.cardUid === "string" && typeof body.signature !== "string" && !body.internalPassportUuid) {
    return testProgrammedCardByUid(body.cardUid);
  }
  if (typeof body.internalPassportUuid === "string" && typeof body.publicPassportNumber === "string") {
    return testInventoryV2({
      internalPassportUuid: body.internalPassportUuid,
      publicPassportNumber: body.publicPassportNumber,
      nfcUid: String(body.nfcUid ?? body.cardUid ?? ""),
      keyVersion: Number(body.keyVersion),
      issuedAt: String(body.issuedAt),
      counter: Number(body.counter),
      signature: String(body.signature),
    });
  }

  if (typeof body.passportId === "string") {
    return testLegacyV1({
      passportId: body.passportId,
      cardUid: String(body.cardUid ?? body.nfcUid ?? ""),
      keyVersion: Number(body.keyVersion),
      issuedAt: String(body.issuedAt),
      counter: Number(body.counter),
      signature: String(body.signature),
    });
  }

  return {
    verdict: "FAIL",
    summary: "Invalid NFC payload - expected v2 inventory tag JSON.",
    checks: [
      {
        id: "payload",
        label: "Valid NFC payload",
        pass: false,
        detail: "Missing internalPassportUuid or passportId.",
      },
    ],
  };
}
