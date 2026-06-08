import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { ChunkLoadRecovery } from "@/components/shared/chunk-load-recovery";
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
    default: "Entertain Passport - Your passport to every event.",
    template: "%s · Entertain Passport",
  },
  description:
    "Your passport to live entertainment - get your visa to every concert, festival, club night and show. Tap your Entertain Passport at the gate. Powered by nZO Innovations.",
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
          <ChunkLoadRecovery />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
