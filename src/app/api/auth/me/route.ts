import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { profileIsComplete } from "@/lib/profile";
import { UserRole } from "@/lib/types";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const profile =
    session.role === UserRole.CUSTOMER
      ? await db.user.findUnique({
          where: { id: session.id },
          select: {
            firstName: true,
            lastName: true,
            name: true,
            phone: true,
            gender: true,
            nic: true,
            idType: true,
            idNumber: true,
            loyaltyPoints: true,
            addresses: {
              where: { isPrimary: true },
              take: 1,
              select: { line1: true, city: true, district: true, province: true, country: true },
            },
          },
        })
      : null;

  const hasPassport =
    session.role === UserRole.CUSTOMER
      ? Boolean(
          await db.rfidCard.findFirst({
            where: { assignedUserId: session.id, status: "ACTIVE" },
            select: { id: true },
          })
        )
      : false;

  const displayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    profile?.name ||
    session.name ||
    session.email.split("@")[0];

  return NextResponse.json(
    {
      user: {
        id: session.id,
        email: session.email,
        name: session.name,
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        displayName,
        role: session.role,
        loyaltyPoints: profile?.loyaltyPoints ?? 0,
        phone: profile?.phone ?? null,
        country: profile?.addresses?.[0]?.country ?? "Sri Lanka",
      },
      profileComplete: profile
        ? profileIsComplete({ ...profile, addresses: profile.addresses })
        : true,
      hasPassport,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
