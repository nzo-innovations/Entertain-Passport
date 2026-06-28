import { createSign } from "crypto";

function base64UrlEncode(value: string | Buffer): string {
  const buf = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buf.toString("base64url");
}

/** Sign a JWT with RS256 (Google Wallet service account). */
export function signRs256Jwt(payload: Record<string, unknown>, privateKeyPem: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKeyPem);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}
