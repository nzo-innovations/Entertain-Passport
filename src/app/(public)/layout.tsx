import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CustomerInactivityGuard } from "@/components/auth/customer-inactivity-guard";
import { CustomerOnboardingBanner } from "@/components/account/customer-onboarding-banner";
import { Suspense } from "react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <CustomerInactivityGuard />
      <Header />
      <Suspense fallback={null}>
        <CustomerOnboardingBanner />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
