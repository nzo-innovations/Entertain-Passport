"use client";

import * as React from "react";
import { CheckCircle2, Copy, Loader2, MonitorSmartphone, Smartphone, Wallet } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { canSaveGoogleWalletInBrowser, shouldShowWalletSaveQr } from "@/lib/device/wallet-save-device";

export type PassportWalletPanelProps = {
  formattedPassportNumber: string;
  holderName: string;
  passportStatus: string;
  googleConfigured: boolean;
  googleProvisioned: boolean;
};

export function PassportWalletPanel({
  formattedPassportNumber,
  holderName,
  passportStatus,
  googleConfigured,
  googleProvisioned,
}: PassportWalletPanelProps) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [saveUrl, setSaveUrl] = React.useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = React.useState(false);
  const [useQrFlow, setUseQrFlow] = React.useState(false);

  React.useEffect(() => {
    setUseQrFlow(shouldShowWalletSaveQr());
  }, []);

  const copySaveLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Open it on your Android phone in Chrome." });
    } catch {
      toast({ title: "Copy failed", description: "Select and copy the link manually.", variant: "destructive" });
    }
  };

  const addToGoogleWallet = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/account/passport/wallet/google", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; saveUrl?: string; error?: string };
      if (!res.ok || !data.ok || !data.saveUrl) {
        toast({
          title: "Google Wallet",
          description: data.error ?? "Could not prepare your virtual passport.",
          variant: "destructive",
        });
        return;
      }

      if (useQrFlow || shouldShowWalletSaveQr()) {
        setSaveUrl(data.saveUrl);
        setQrDialogOpen(true);
        toast({
          title: "Scan with your Android phone",
          description: "Use the QR code to add the pass to Google Wallet on your phone.",
        });
        return;
      }

      toast({
        title: googleProvisioned ? "Opening Google Wallet" : "Add to Google Wallet",
        description: "Complete the save flow on this device.",
      });
      window.location.href = data.saveUrl;
    } catch {
      toast({
        title: "Google Wallet",
        description: "Network error. Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onPhoneHint = useQrFlow;

  return (
    <>
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold">Virtual Entertain Passport</h2>
            <p className="text-sm text-muted-foreground">
              Your virtual Entertain Passport card in Google Wallet. Turn on NFC on your phone, open the
              pass, and tap the gate NFC reader - same check-in as your physical card.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4 text-center space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entertain Passport</p>
          <p className="font-mono text-lg font-semibold">{formattedPassportNumber}</p>
          <p className="text-sm text-muted-foreground">{holderName}</p>
          <p className="text-xs text-muted-foreground pt-1">Status: {passportStatus}</p>
        </div>

        {onPhoneHint && googleConfigured && (
          <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-sm text-muted-foreground">
            <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <p>
              You&apos;re on a computer. We&apos;ll show a <strong className="text-foreground">QR code</strong> so
              you can open Google Wallet setup on your <strong className="text-foreground">Android phone</strong>.
            </p>
          </div>
        )}

        {googleProvisioned && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Virtual passport linked to Google Wallet. Tap below to update or re-save the pass.
          </div>
        )}

        {!googleConfigured ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Google Wallet setup pending</p>
            <p className="mt-1">
              Your virtual passport is ready in our system, but Google Wallet issuer credentials are not
              configured on this environment yet. Use your physical card at the gate, or ask support to
              enable Google Wallet.
            </p>
          </div>
        ) : (
          <Button variant="brand" className="w-full sm:w-auto" disabled={busy} onClick={() => void addToGoogleWallet()}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            {googleProvisioned ? "Update Google Wallet pass" : "Add to Google Wallet"}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          {canSaveGoogleWalletInBrowser()
            ? "Complete Google Wallet on this phone, then tap the pass at the gate NFC reader."
            : "Requires an Android phone with Google Wallet and NFC enabled. QR is only for adding the pass - not used at the gate."}
        </p>
      </section>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Google Wallet on your phone</DialogTitle>
            <DialogDescription>
              Scan this QR code with your Android phone camera or Chrome, then follow Google&apos;s steps to
              save your Entertain Passport pass.
            </DialogDescription>
          </DialogHeader>

          {saveUrl && (
            <div className="space-y-4">
              <div className="mx-auto w-fit rounded-xl border bg-white p-4">
                <QRCode value={saveUrl} size={220} level="M" />
              </div>

              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
                <li>Open the camera or Chrome on your <strong className="text-foreground">Android phone</strong>.</li>
                <li>Scan the QR code (or use Copy link below).</li>
                <li>Tap <strong className="text-foreground">Add to Google Wallet</strong> when Google opens.</li>
                <li>At the event, open the pass and tap the gate NFC reader.</li>
              </ol>

              <div className="flex flex-wrap gap-2">
                <Button variant="brand" size="sm" onClick={() => void copySaveLink(saveUrl)}>
                  <Copy className="h-3.5 w-3.5" /> Copy link for phone
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQrDialogOpen(false)}>
                  Done
                </Button>
              </div>

              <p className="text-xs text-muted-foreground break-all">{saveUrl.slice(0, 80)}…</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
