import { randomInt } from "crypto";

const IST_TIMEZONE = "Asia/Kolkata";
const WORLD_TIME_API = "https://worldtimeapi.org/api/timezone/Asia/Kolkata";

export type IstBatchParts = {
  yy: string;
  mm: string;
  dd: string;
  time: string;
  label: string;
};

export type BatchCodeSuggestion = {
  batchCode: string;
  istLabel: string;
  source: "worldtimeapi" | "server";
};

function formatIstParts(instant: Date): IstBatchParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const yy = pick("year");
  const mm = pick("month");
  const dd = pick("day");
  const hh = pick("hour");
  const mi = pick("minute");
  const ss = pick("second");

  return {
    yy,
    mm,
    dd,
    time: `${hh}${mi}${ss}`,
    label: `${yy}-${mm}-${dd} ${hh}:${mi}:${ss} IST`,
  };
}

async function resolveIstInstant(): Promise<{ instant: Date; source: BatchCodeSuggestion["source"] }> {
  try {
    const res = await fetch(WORLD_TIME_API, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = (await res.json()) as { datetime?: string; utc_datetime?: string };
      const raw = data.datetime ?? data.utc_datetime;
      if (raw) {
        const instant = new Date(raw);
        if (!Number.isNaN(instant.getTime())) {
          return { instant, source: "worldtimeapi" };
        }
      }
    }
  } catch {
    /* fall back to server clock formatted as IST */
  }

  return { instant: new Date(), source: "server" };
}

/** EP-{YY}-{MM}-{DD}-{HHmmss}-{random4} using Asia/Kolkata (IST). */
export async function suggestPassportBatchCode(
  takenCodes: Iterable<string> = []
): Promise<BatchCodeSuggestion> {
  const taken = new Set(Array.from(takenCodes, (c) => c.trim().toUpperCase()));
  const { instant, source } = await resolveIstInstant();
  const parts = formatIstParts(instant);

  for (let attempt = 0; attempt < 30; attempt++) {
    const rnd = randomInt(1000, 10000);
    const code = `EP-${parts.yy}-${parts.mm}-${parts.dd}-${parts.time}-${rnd}`.slice(0, 40);
    if (!taken.has(code.toUpperCase())) {
      return { batchCode: code, istLabel: parts.label, source };
    }
  }

  const rnd = randomInt(10000, 100000);
  const code = `EP-${parts.yy}-${parts.mm}-${parts.dd}-${parts.time}-${rnd}`.slice(0, 40);
  return { batchCode: code, istLabel: parts.label, source };
}
