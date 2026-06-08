import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
