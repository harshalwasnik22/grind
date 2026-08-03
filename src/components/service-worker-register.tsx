"use client";

import { useEffect } from "react";

/** Registers the GRIND service worker on mount (no-op where unsupported). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        /* registration is best-effort */
      });
  }, []);

  return null;
}
