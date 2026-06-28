import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { ChunkLoadRecovery } from "@/components/shared/chunk-load-recovery";
import { CustomerSessionProvider } from "@/components/auth/customer-session-provider";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Entertain Passport - The most powerful passport granting visa-free access to unforgettable experiences.",
    template: "%s · Entertain Passport",
  },
  description:
    "Your passport to live entertainment - get your visa to every concert, drama, nightlife, restaurant, dating, and unforgettable experience. Tap your Entertain Passport at the gate.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${display.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <CustomerSessionProvider>
            <ChunkLoadRecovery />
            {children}
            <Toaster />
          </CustomerSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
