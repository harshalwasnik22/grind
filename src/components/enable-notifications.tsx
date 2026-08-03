"use client";

import { useEffect, useState } from "react";
import { PixelButton } from "@/components/ui/pixel-button";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State =
  | "loading"
  | "unconfigured"
  | "unsupported"
  | "blocked"
  | "prompt"
  | "working"
  | "enabled";

/**
 * Opt-in button for Web Push reminders. Requests permission, subscribes via
 * the service worker, and stores the subscription server-side. Degrades to a
 * clear status message when unsupported / blocked / unconfigured.
 */
export function EnableNotifications() {
  const [state, setState] = useState<State>("loading");
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!vapid) {
      setState("unconfigured");
      return;
    }
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "enabled" : "prompt"))
      .catch(() => setState("prompt"));
  }, [vapid]);

  async function enable() {
    if (!vapid) return;
    try {
      setState("working");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "blocked" : "prompt");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: JSON.parse(JSON.stringify(sub)) }),
      });
      setState(res.ok ? "enabled" : "prompt");
    } catch {
      setState("prompt");
    }
  }

  if (state === "loading") return null;
  if (state === "unconfigured")
    return (
      <p className="text-sm text-muted">Push reminders aren&apos;t configured.</p>
    );
  if (state === "unsupported")
    return (
      <p className="text-sm text-muted">
        This browser can&apos;t do push notifications.
      </p>
    );
  if (state === "blocked")
    return (
      <p className="text-sm text-hp">
        Notifications are blocked — enable them in your browser settings.
      </p>
    );
  if (state === "enabled")
    return (
      <p className="text-sm text-xp">
        🔔 Reminders on — we&apos;ll nudge you if you forget to log.
      </p>
    );

  return (
    <PixelButton size="sm" onClick={enable} disabled={state === "working"}>
      {state === "working" ? "Enabling…" : "Enable Reminders"}
    </PixelButton>
  );
}
