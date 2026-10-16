"use client";

import Script from "next/script";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

type FieldErrors = Partial<Record<"name" | "email" | "message", string>>;
type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string; showEmail: boolean };

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Contact form. Spam protection: a hidden honeypot field, a minimum fill time, link limits (all
 * checked on the server) and, when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, a Cloudflare Turnstile
 * challenge. If the server cannot deliver the message, the form points to the email address.
 */
export function ContactForm({ email }: { email: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [startedAt] = useState(() => Date.now());

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setState({ kind: "sending" });
    setErrors({});

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          website: data.get("website"),
          startedAt,
          turnstileToken: data.get("cf-turnstile-response"),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        errors?: FieldErrors;
        error?: string;
        fallback?: string;
      };
      if (json.ok) {
        form.reset();
        setState({ kind: "sent" });
      } else if (json.errors) {
        setErrors(json.errors);
        setState({ kind: "idle" });
      } else {
        setState({
          kind: "error",
          message: json.error ?? "Something went wrong.",
          showEmail: json.fallback === "email",
        });
      }
    } catch {
      setState({
        kind: "error",
        message: "We could not reach the server. Please check your connection and try again.",
        showEmail: true,
      });
    }
  }

  if (state.kind === "sent") {
    return (
      <Card role="status" className="flex flex-col gap-2">
        <p className="text-lg font-semibold">Thank you, your message is on its way.</p>
        <p className="text-muted">We read every message and reply within a few business days.</p>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
      {/* Honeypot: hidden from people and assistive tech. Bots tend to fill every field. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Input
        id="contact-name"
        name="name"
        label="Your name"
        autoComplete="name"
        required
        maxLength={100}
        error={errors.name}
      />
      <Input
        id="contact-email"
        name="email"
        type="email"
        label="Your email address"
        autoComplete="email"
        required
        maxLength={200}
        hint="So we can reply. We will not add you to any list."
        error={errors.email}
      />
      <Textarea
        id="contact-message"
        name="message"
        label="Your message"
        required
        minLength={10}
        maxLength={5000}
        error={errors.message}
      />

      {TURNSTILE_SITE_KEY && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="lazyOnload"
          />
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} />
        </>
      )}

      {state.kind === "error" && (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
          {state.showEmail && (
            <>
              {" "}
              You can also email us at{" "}
              <a href={`mailto:${email}`} className="underline underline-offset-2">
                {email}
              </a>
              .
            </>
          )}
        </p>
      )}

      <Button type="submit" disabled={state.kind === "sending"} className="self-start">
        {state.kind === "sending" ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
