/** True when Google Wallet save can complete in this browser (Android phone). */
export function canSaveGoogleWalletInBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && /Mobile/i.test(ua);
}

/** Desktop, tablet, or iPhone - show QR + link so user opens save URL on Android phone. */
export function shouldShowWalletSaveQr(): boolean {
  return !canSaveGoogleWalletInBrowser();
}
