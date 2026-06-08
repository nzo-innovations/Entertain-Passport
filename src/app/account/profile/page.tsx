import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, PartyPopper, Sparkles } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { ProfileForm, type ProfileFormData } from "@/components/account/profile-form";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { profileIsComplete, missingProfileFields } from "@/lib/profile";

export const dynamic = "force-dynamic";

export const metadata = { title: "My profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: { welcome?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/profile");

  const user = await db.user.findUnique({
    where: { id: session.id },
    include: { addresses: { orderBy: { isPrimary: "desc" }, take: 1 } },
  });
  if (!user) redirect("/login");

  const addr = user.addresses[0];
  const initial: ProfileFormData = {
    name: user.name ?? "",
    email: user.email,
    phone: user.phone ?? "",
    gender: user.gender ?? "",
    birthday: user.birthday ? new Date(user.birthday).toISOString().slice(0, 10) : "",
    idType: user.idType ?? "",
    idNumber: user.idNumber ?? "",
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

  return (
    <>
      <Header />
      <main className="container max-w-3xl py-12">
        {welcome && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <PartyPopper className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Welcome to Entertain Passport!</p>
              <p className="text-sm text-muted-foreground">
                Complete your profile to unlock loyalty rewards - or skip and do it later.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">My profile</h1>
            <p className="text-sm text-muted-foreground">
              Manage your personal info. You can update this anytime.
            </p>
          </div>
          <Link href="/account/tickets" className="text-sm font-medium text-primary hover:underline">
            My tickets
          </Link>
        </div>

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
