import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PassportCardOrderPanel } from "@/components/account/passport-card-order";
import { PassportWalletPanel } from "@/components/account/passport-wallet-panel";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWalletCredentialStatus } from "@/lib/passport/wallet-credential-service";
import { ROUTES } from "@/lib/config";

export const metadata = { title: "Order Entertain Passport" };

export default async function PassportOrderPage({
  searchParams,
}: {
  searchParams?: { ok?: string };
}) {
  const session = await getSession();
  if (!session) redirect(`/login?next=${ROUTES.passport}`);

  const justPaid = searchParams?.ok === "1";

  const [passport, settings, cardOrders, user, walletStatus] = await Promise.all([
    db.rfidCard.findFirst({
      where: { assignedUserId: session.id, status: "ACTIVE" },
      select: { passportNo: true },
    }),
    db.platformSettings.findUnique({ where: { id: "default" } }),
    db.passportCardOrder.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.user.findUnique({
      where: { id: session.id },
      include: { addresses: { orderBy: { isPrimary: "desc" }, take: 1 } },
    }),
    getWalletCredentialStatus(session.id),
  ]);

  const addr = user?.addresses[0];
  const canShip = Boolean(user?.phone && addr?.line1 && addr?.city && addr?.district && addr?.province);
  const shippingSummary = addr
    ? [addr.line1, addr.line2, addr.city, addr.district, addr.province, addr.country]
        .filter(Boolean)
        .join(", ")
    : null;
  const deferredCardTotal = cardOrders
    .filter((order) => order.status === "DEFERRED")
    .reduce((sum, order) => sum + order.total, 0);

  return (
    <>
      <Header />
      <main className="container max-w-3xl py-12">
        {justPaid && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">Payment confirmed!</p>
              <p className="text-sm text-muted-foreground">
                Your Entertain Passport card order is paid. We&apos;ll ship it by SL registered post.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Entertain Passport card</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your physical membership card for faster gate entry and loyalty rewards.
            </p>
          </div>
          <Link href={ROUTES.tickets} className="text-sm font-medium text-primary hover:underline">
            My tickets
          </Link>
        </div>

        {passport && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">
                Your card: <span className="font-mono">{passport.passportNo}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Tap your Entertain Passport at the gate to enter. You can order a replacement if
                yours is lost or damaged.
              </p>
            </div>
          </div>
        )}

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

        <div className="mt-6">
          <PassportCardOrderPanel
            hasPassport={!!passport}
            canShip={canShip}
            price={settings?.passportCardPrice ?? 50_000}
            shippingSummary={shippingSummary}
            latestOrder={cardOrders[0] ?? null}
            deferredTotal={deferredCardTotal}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
