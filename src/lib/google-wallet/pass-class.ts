import type { GoogleWalletConfig } from "./config";
import { googleWalletClassId } from "./config";
import { getGoogleWalletAccessToken } from "./auth";

type LocalizedString = {
  defaultValue: { language: string; value: string };
};

function localized(value: string): LocalizedString {
  return { defaultValue: { language: "en-US", value: value } };
}

/** Generic pass class with NFC Smart Tap enabled (phone tap at gate - no QR). */
export function buildGoogleGenericPassClass(config: GoogleWalletConfig) {
  return {
    id: googleWalletClassId(config),
    reviewStatus: "UNDER_REVIEW",
    enableSmartTap: true,
    redemptionIssuers: [config.issuerId],
    cardTitle: localized("Entertain Passport"),
    hexBackgroundColor: "#0f172a",
  };
}

export async function ensureGoogleWalletGenericClass(config: GoogleWalletConfig): Promise<void> {
  const token = await getGoogleWalletAccessToken({
    serviceAccountEmail: config.serviceAccountEmail,
    privateKeyPem: config.privateKeyPem,
  });

  const classId = googleWalletClassId(config);
  const classBody = buildGoogleGenericPassClass(config);

  const getRes = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${encodeURIComponent(classId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (getRes.ok) {
    await fetch(
      `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${encodeURIComponent(classId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enableSmartTap: true,
          redemptionIssuers: [config.issuerId],
        }),
      }
    );
    return;
  }

  if (getRes.status !== 404) {
    let message = `HTTP ${getRes.status}`;
    try {
      const err = (await getRes.json()) as { error?: { message?: string } };
      if (err.error?.message) message = err.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(`Could not load Google Wallet pass class: ${message}`);
  }

  const insertRes = await fetch("https://walletobjects.googleapis.com/walletobjects/v1/genericClass", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(classBody),
  });

  if (!insertRes.ok) {
    let message = `HTTP ${insertRes.status}`;
    try {
      const err = (await insertRes.json()) as { error?: { message?: string } };
      if (err.error?.message) message = err.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(`Could not create Google Wallet pass class: ${message}`);
  }
}
