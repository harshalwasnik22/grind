"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PixelButton } from "@/components/ui/pixel-button";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm({ next = "/" }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(
      next,
    )}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo, shouldCreateUser: true },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="text-center">
        <p className="pixel-title text-[0.7rem] text-xp">✉ Check your email</p>
        <p className="mt-3 text-lg text-muted">
          We sent a magic link to <span className="text-fg">{email}</span>.
          Click it to enter the arena.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setMessage("");
          }}
          className="mt-4 text-base text-info underline underline-offset-4"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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

      {status === "error" && (
        <p className="text-base text-hp">⚠ {message}</p>
      )}

      <PixelButton
        type="submit"
        variant="primary"
        disabled={status === "sending"}
        className="w-full"
      >
        {status === "sending" ? "Sending…" : "Send Magic Link"}
      </PixelButton>
    </form>
  );
}
