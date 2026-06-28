/**
 * Verify Google Wallet issuer credentials and pass class.
 * Run: npm run wallet:check
 */
import { createSign } from "crypto";
import {
  fetchGoogleWalletGenericClass,
  getGoogleWalletAccessToken,
} from "../src/lib/google-wallet/auth";
import {
  getGoogleWalletConfig,
  googleWalletClassId,
  isGoogleWalletConfigured,
} from "../src/lib/google-wallet/config";

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  const mark = ok ? "OK" : "FAIL";
  console.log(`  [${mark}] ${name}: ${detail}`);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.length <= 2 ? local : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function validatePrivateKey(pem: string): boolean {
  try {
    const signer = createSign("RSA-SHA256");
    signer.update("wallet-check");
    signer.end();
    signer.sign(pem);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("\nEntertain Passport - Google Wallet check\n");

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const serviceAccountEmail = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKeyRaw = process.env.GOOGLE_WALLET_PRIVATE_KEY?.trim();
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX?.trim() || "entertain_passport";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

  record("GOOGLE_WALLET_ISSUER_ID", Boolean(issuerId), issuerId ? "set" : "missing");
  if (issuerId && !/^\d+$/.test(issuerId)) {
    record("issuer id format", false, "should be numeric (from Google Pay & Wallet Console)");
  } else if (issuerId) {
    record("issuer id format", true, "numeric");
  }

  record(
    "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
    Boolean(serviceAccountEmail),
    serviceAccountEmail ? maskEmail(serviceAccountEmail) : "missing"
  );
  if (serviceAccountEmail && !serviceAccountEmail.endsWith(".iam.gserviceaccount.com")) {
    record("service account format", false, "expected *@*.iam.gserviceaccount.com");
  } else if (serviceAccountEmail) {
    record("service account format", true, "looks valid");
  }

  record("GOOGLE_WALLET_PRIVATE_KEY", Boolean(privateKeyRaw), privateKeyRaw ? "set (hidden)" : "missing");

  const privateKeyPem = privateKeyRaw?.includes("\\n")
    ? privateKeyRaw.replace(/\\n/g, "\n")
    : privateKeyRaw;

  if (privateKeyPem) {
    record(
      "private key PEM",
      validatePrivateKey(privateKeyPem),
      validatePrivateKey(privateKeyPem) ? "RSA key parses and signs" : "invalid or malformed PEM"
    );
  }

  record("GOOGLE_WALLET_CLASS_SUFFIX", true, classSuffix);
  record("NEXT_PUBLIC_SITE_URL", Boolean(siteUrl), siteUrl);

  if (!isGoogleWalletConfigured()) {
    console.log("\nResult: not configured - add Google Wallet vars to .env (see .env.example).\n");
    process.exit(1);
  }

  const config = getGoogleWalletConfig()!;
  const classId = googleWalletClassId(config);
  record("pass class id", true, classId);

  try {
    const token = await getGoogleWalletAccessToken({
      serviceAccountEmail: config.serviceAccountEmail,
      privateKeyPem: config.privateKeyPem,
    });
    record("Google OAuth token", true, "service account authenticated");
    void token;

    const classResult = await fetchGoogleWalletGenericClass({
      accessToken: token,
      classId,
    });

    if (classResult.ok) {
      record("Generic pass class", true, `found (${classResult.id})`);
    } else if (classResult.status === 404) {
      record(
        "Generic pass class",
        false,
        `not found - create class "${classId}" in Google Pay & Wallet Console (Generic pass)`
      );
    } else if (classResult.status === 403) {
      record(
        "Generic pass class",
        false,
        `${classResult.message} - invite ${maskEmail(config.serviceAccountEmail)} as Developer in Wallet Console`
      );
    } else {
      record("Generic pass class", false, classResult.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    record("Google API", false, message);
    if (message.includes("invalid_grant") || message.includes("401")) {
      console.log("\n  Tip: ensure the service account email is added as a Developer user in Google Pay & Wallet Console.");
    }
  }

  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\nResult: ${failed === 0 ? "all checks passed" : `${failed} check(s) failed`}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
