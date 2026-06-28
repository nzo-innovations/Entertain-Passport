import { signRs256Jwt } from "./jwt";

const WALLET_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

export async function getGoogleWalletAccessToken(args: {
  serviceAccountEmail: string;
  privateKeyPem: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signRs256Jwt(
    {
      iss: args.serviceAccountEmail,
      scope: WALLET_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    args.privateKeyPem
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    const detail = data.error_description ?? data.error ?? `HTTP ${res.status}`;
    throw new Error(`OAuth token request failed: ${detail}`);
  }

  return data.access_token;
}

export async function fetchGoogleWalletGenericClass(args: {
  accessToken: string;
  classId: string;
}): Promise<{ ok: true; id: string } | { ok: false; status: number; message: string }> {
  const res = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${encodeURIComponent(args.classId)}`,
    {
      headers: { Authorization: `Bearer ${args.accessToken}` },
    }
  );

  if (res.ok) {
    const body = (await res.json()) as { id?: string };
    return { ok: true, id: body.id ?? args.classId };
  }

  let message = `HTTP ${res.status}`;
  try {
    const err = (await res.json()) as { error?: { message?: string } };
    if (err.error?.message) message = err.error.message;
  } catch {
    /* ignore */
  }

  return { ok: false, status: res.status, message };
}
