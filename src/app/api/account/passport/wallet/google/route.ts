import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { provisionGoogleWalletPassport } from "@/lib/passport/wallet-credential-service";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await provisionGoogleWalletPassport(session.id);
    return NextResponse.json({
      ok: true,
      saveUrl: result.saveUrl,
      formattedPassportNumber: result.formattedPassportNumber,
      holderName: result.holderName,
      reprovisioned: result.reprovisioned,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not add passport to Google Wallet.";
    return NextResponse.json({ ok: false, error: message }, { status: 409 });
  }
}
