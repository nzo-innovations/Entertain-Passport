import { randomBytes } from "crypto";
import { getGoogleWalletConfig, googleWalletClassId, googleWalletObjectId, type GoogleWalletConfig } from "./config";
import { signRs256Jwt } from "./jwt";
import { buildGoogleGenericPassClass, ensureGoogleWalletGenericClass } from "./pass-class";

type LocalizedString = {
  defaultValue: { language: string; value: string };
};

function localized(value: string): LocalizedString {
  return { defaultValue: { language: "en-US", value: value } };
}

/** Unique Smart Tap redemption token - resolved server-side at gate (no QR). */
export function buildSmartTapRedemptionValue(): string {
  return `EP${randomBytes(16).toString("hex").toUpperCase()}`;
}

/** Google Wallet pass object - card display + NFC Smart Tap (no barcode/QR). */
export function buildGoogleGenericPassObject(args: {
  config: GoogleWalletConfig;
  inventoryId: string;
  formattedPassportNumber: string;
  holderName: string;
  smartTapRedemptionValue: string;
}) {
  return {
    id: googleWalletObjectId(args.config, args.inventoryId),
    classId: googleWalletClassId(args.config),
    state: "ACTIVE",
    cardTitle: localized("Entertain Passport"),
    header: localized(args.formattedPassportNumber),
    subheader: localized(args.holderName),
    hexBackgroundColor: "#0f172a",
    smartTapRedemptionValue: args.smartTapRedemptionValue,
  };
}

export async function buildGoogleWalletSaveUrl(args: {
  inventoryId: string;
  formattedPassportNumber: string;
  holderName: string;
  smartTapRedemptionValue: string;
}): Promise<{ saveUrl: string; objectId: string; classId: string }> {
  const config = getGoogleWalletConfig();
  if (!config) {
    throw new Error(
      "Google Wallet is not configured. Set GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL, and GOOGLE_WALLET_PRIVATE_KEY."
    );
  }

  await ensureGoogleWalletGenericClass(config);

  const passClass = buildGoogleGenericPassClass(config);
  const passObject = buildGoogleGenericPassObject({ config, ...args });
  const now = Math.floor(Date.now() / 1000);

  const jwt = signRs256Jwt(
    {
      iss: config.serviceAccountEmail,
      aud: "google",
      typ: "savetowallet",
      iat: now,
      origins: config.origins,
      payload: {
        genericClasses: [passClass],
        genericObjects: [passObject],
      },
    },
    config.privateKeyPem
  );

  return {
    saveUrl: `https://pay.google.com/gp/v/save/${jwt}`,
    objectId: passObject.id,
    classId: passObject.classId,
  };
}
