export type NicValidationResult = {
  ok: boolean;
  normalized: string;
  error?: string;
};

export function normalizeNic(nic: string | null | undefined): string {
  return (nic ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
}

function validDaySerial(value: string) {
  const day = Number(value);
  return (day >= 1 && day <= 366) || (day >= 501 && day <= 866);
}

export function validateNic(nic: string): NicValidationResult {
  const normalized = normalizeNic(nic);

  if (!normalized) {
    return { ok: false, normalized, error: "NIC is required." };
  }

  const oldMatch = normalized.match(/^(\d{2})(\d{3})\d{4}[VX]$/);
  if (oldMatch) {
    if (!validDaySerial(oldMatch[2])) {
      return { ok: false, normalized, error: "Enter a valid Sri Lankan NIC." };
    }
    return { ok: true, normalized };
  }

  const newMatch = normalized.match(/^(\d{4})(\d{3})\d{5}$/);
  if (newMatch) {
    if (!validDaySerial(newMatch[2])) {
      return { ok: false, normalized, error: "Enter a valid Sri Lankan NIC." };
    }
    return { ok: true, normalized };
  }

  return {
    ok: false,
    normalized,
    error: "NIC must be 12 digits, or 9 digits followed by V or X.",
  };
}
