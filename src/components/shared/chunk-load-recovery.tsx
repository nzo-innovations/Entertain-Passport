"use client";

import { useEffect } from "react";

const RELOAD_KEY = "ep-chunk-reload";

function isChunkLoadFailure(message: string, name?: string) {
  return (
    name === "ChunkLoadError" ||
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch dynamically imported module")
  );
}

/** One automatic hard reload when stale JS chunks 404/400 after a new deploy or rebuild. */
export function ChunkLoadRecovery() {
  useEffect(() => {
    sessionStorage.removeItem(RELOAD_KEY);

    function maybeReload(message: string, name?: string) {
      if (!isChunkLoadFailure(message, name)) return;
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      maybeReload(event.message ?? "", event.error?.name);
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      if (reason instanceof Error) {
        maybeReload(reason.message, reason.name);
        return;
      }
      maybeReload(String(reason ?? ""));
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
