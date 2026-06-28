import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getWalletCredentialStatus } from "@/lib/passport/wallet-credential-service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getWalletCredentialStatus(session.id);
  return NextResponse.json(status);
}
