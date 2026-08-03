"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PixelButton } from "@/components/ui/pixel-button";

type Step = "email" | "code";
type Status = "idle" | "sending" | "verifying" | "error";

/** Only follow same-origin relative redirects — never an off-site URL. */
function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Passwordless sign-in with a 6-digit email **OTP** (no magic link). Step 1
 * sends the code via `signInWithOtp`; step 2 verifies it with `verifyOtp`,
 * which sets the session cookies in the browser. We then hard-navigate so the
 * server picks up the session and `requirePlayer` routes new players to
 * onboarding.
 *
 * Requires the Supabase **Magic Link** email template to surface the code —
 * include `{{ .Token }}` in it (see SETUP.md).
 */
export function LoginForm({ next = "/" }: { next?: string }) {
  const [supabase] = useState(() => createClient());
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const address = email.trim();
    if (!address) return;
    setStatus("sending");
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("idle");
      setStep("code");
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (token.length < 6) return;
    setStatus("verifying");
    setMessage("");

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });

    if (error) {
      setStatus("error");
      setMessage("That code was invalid or expired. Try again.");
    } else {
      // Session cookie is set — full navigation so the server sees it.
      window.location.assign(safeNext(next));
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="space-y-4">
        <p className="text-center text-lg text-muted">
          Enter the 6-digit code we sent to{" "}
          <span className="text-fg">{email}</span>.
        </p>

        <label className="block">
          <span className="pixel-title text-[0.5rem] uppercase text-muted">
            Code
          </span>
          <div className="pixel-inset mt-2 px-3 py-2">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full bg-transparent text-center text-2xl tracking-[0.4em] text-fg placeholder:text-muted focus:outline-none"
            />
          </div>
        </label>

        {status === "error" && (
          <p className="text-base text-hp">⚠ {message}</p>
        )}

        <PixelButton
          type="submit"
          variant="primary"
          disabled={status === "verifying" || code.trim().length < 6}
          className="w-full"
        >
          {status === "verifying" ? "Verifying…" : "Enter the Arena"}
        </PixelButton>

        <div className="flex justify-between text-base">
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setStatus("idle");
              setMessage("");
            }}
            className="text-info underline underline-offset-4"
          >
            ← Change email
          </button>
          <button
            type="button"
            onClick={() => sendCode()}
            disabled={status === "sending"}
            className="text-info underline underline-offset-4 disabled:opacity-50"
          >
            {status === "sending" ? "Resending…" : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-4">
      <label className="block">
        <span className="pixel-title text-[0.5rem] uppercase text-muted">
          Email
        </span>
        <div className="pixel-inset mt-2 px-3 py-2">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-transparent text-lg text-fg placeholder:text-muted focus:outline-none"
          />
        </div>
      </label>

      {status === "error" && <p className="text-base text-hp">⚠ {message}</p>}

      <PixelButton
        type="submit"
        variant="primary"
        disabled={status === "sending"}
        className="w-full"
      >
        {status === "sending" ? "Sending…" : "Send Code"}
      </PixelButton>
    </form>
  );
}
