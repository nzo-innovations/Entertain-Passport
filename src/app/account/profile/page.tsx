import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, PartyPopper, Sparkles } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { ProfileForm, type ProfileFormData } from "@/components/account/profile-form";
import { PassportWalletPanel } from "@/components/account/passport-wallet-panel";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWalletCredentialStatus } from "@/lib/passport/wallet-credential-service";
import { profileIdentity, profileIsComplete, missingProfileFields } from "@/lib/profile";

export const dynamic = "force-dynamic";

export const metadata = { title: "My profile" };

function splitName(name: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: { welcome?: string; next?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/profile");

  const user = await db.user.findUnique({
    where: { id: session.id },
    include: { addresses: { orderBy: { isPrimary: "desc" }, take: 1 } },
  });
  if (!user) redirect("/login");

  const addr = user.addresses[0];
  const split = splitName(user.name);
  const identity = profileIdentity(user);
  const initial: ProfileFormData = {
    firstName: user.firstName ?? split.firstName,
    lastName: user.lastName ?? split.lastName,
    email: user.email,
    idType: identity?.type ?? "NIC",
    idNumber: identity?.number ?? "",
    phone: user.phone ?? "",
    gender: user.gender ?? "",
    birthday: user.birthday ? new Date(user.birthday).toISOString().slice(0, 10) : "",
    address: {
      line1: addr?.line1 ?? "",
      line2: addr?.line2 ?? "",
      city: addr?.city ?? "",
      district: addr?.district ?? "",
      province: addr?.province ?? "",
      country: addr?.country ?? "Sri Lanka",
      zip: addr?.zip ?? "",
    },
  };

  const complete = profileIsComplete({ ...user, addresses: user.addresses });
  const missing = missingProfileFields({ ...user, addresses: user.addresses });
  const welcome = searchParams?.welcome === "1";
  const returnToCheckout = searchParams?.next === "/checkout";
  const walletStatus = await getWalletCredentialStatus(session.id);

  return (
    <>
      <Header />
      <main className="container max-w-3xl py-12">
        {returnToCheckout && !complete && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Complete your profile to buy tickets</p>
              <p className="text-sm text-muted-foreground">
                Add your mobile, gender and address, then you&apos;ll return to checkout.
              </p>
            </div>
          </div>
        )}
        {welcome && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <PartyPopper className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Welcome to Entertain Passport!</p>
              <p className="text-sm text-muted-foreground">
                Add your mobile, gender and address to unlock loyalty rewards and card delivery.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">My profile</h1>
            <p className="text-sm text-muted-foreground">
              Manage your identity, contact details and card delivery address.
            </p>
          </div>
          <Link href="/account/tickets" className="text-sm font-medium text-primary hover:underline">
            My tickets
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Loyalty points
          </p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums">
            {user.loyaltyPoints.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Points appear here after eligible orders and member offers.
          </p>
        </div>

        {walletStatus.hasPassport && (
          <div className="mt-6">
            <PassportWalletPanel
              formattedPassportNumber={walletStatus.formattedPassportNumber}
              holderName={walletStatus.holderName}
              passportStatus={walletStatus.passportStatus}
              googleConfigured={walletStatus.googleWallet.configured}
              googleProvisioned={walletStatus.googleWallet.provisioned}
            />
          </div>
        )}

        <div
          className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 ${
            complete
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          {complete ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
          ) : (
            <Sparkles className="mt-0.5 h-5 w-5 text-amber-500" />
          )}
          <div>
            <p className="font-medium">
              {complete ? "Loyalty profile complete" : "Finish your profile for loyalty rewards"}
            </p>
            <p className="text-sm text-muted-foreground">
              {complete
                ? "You're eligible for member offers and loyalty rewards."
                : `Add your ${missing.join(", ")} to qualify for offers & loyalty rewards.`}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <ProfileForm initial={initial} showSkip={welcome} />
        </div>
      </main>
      <Footer />
    </>
  );
}
