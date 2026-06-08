import { NextResponse } from "next/server";
import { getUserRole } from "@/lib/auth";

export async function GET() {
  const role = await getUserRole();
  return NextResponse.json(
    { role },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
