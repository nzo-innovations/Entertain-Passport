/** Client-side gate before checkout - auth, role, and profile completeness. */

export type CheckoutGateResult =
  | { ok: true }
  | { ok: false; href: string; reason: "auth" | "profile" | "role" };

type MeResponse = {
  user: { role: string } | null;
  profileComplete?: boolean;
};

export async function resolveCheckoutDestination(): Promise<CheckoutGateResult> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
    const data = (await res.json()) as MeResponse;

    if (!data.user) {
      return { ok: false, href: "/login?next=/checkout&signup=1", reason: "auth" };
    }

    if (data.user.role !== "CUSTOMER") {
      return { ok: false, href: "/login?next=/checkout", reason: "role" };
    }

    if (!data.profileComplete) {
      return { ok: false, href: "/account/profile?next=/checkout", reason: "profile" };
    }

    return { ok: true };
  } catch {
    return { ok: false, href: "/login?next=/checkout&signup=1", reason: "auth" };
  }
}
