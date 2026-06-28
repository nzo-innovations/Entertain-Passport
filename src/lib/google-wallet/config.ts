export type GoogleWalletConfig = {
  issuerId: string;
  serviceAccountEmail: string;
  privateKeyPem: string;
  classSuffix: string;
  origins: string[];
};

export function getGoogleWalletConfig(): GoogleWalletConfig | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const serviceAccountEmail = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKeyRaw = process.env.GOOGLE_WALLET_PRIVATE_KEY?.trim();
  if (!issuerId || !serviceAccountEmail || !privateKeyRaw) return null;

  const privateKeyPem = privateKeyRaw.includes("\\n")
    ? privateKeyRaw.replace(/\\n/g, "\n")
    : privateKeyRaw;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const origins = [siteUrl.replace(/\/$/, "")];

  return {
    issuerId,
    serviceAccountEmail,
    privateKeyPem,
    classSuffix: process.env.GOOGLE_WALLET_CLASS_SUFFIX?.trim() || "entertain_passport",
    origins,
  };
}

export function isGoogleWalletConfigured(): boolean {
  return getGoogleWalletConfig() !== null;
}

export function googleWalletClassId(config: GoogleWalletConfig): string {
  return `${config.issuerId}.${config.classSuffix}`;
}

export function googleWalletObjectId(config: GoogleWalletConfig, inventoryId: string): string {
  const suffix = inventoryId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${config.issuerId}.ep_${suffix}`;
}
