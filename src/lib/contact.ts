/**
 * Contact form validation and spam checks. Pure functions so they can be unit tested; the API
 * route in src/app/api/contact/route.ts wires them to the request and to message delivery.
 */

export type ContactInput = {
  name: string;
  email: string;
  message: string;
  /** Honeypot: a hidden field that real visitors never fill in. */
  website: string;
  /** Milliseconds since epoch at which the form was rendered. */
  startedAt: number;
};

export type ContactErrors = Partial<Record<"name" | "email" | "message", string>>;

export type ContactCheck =
  | { ok: true; value: { name: string; email: string; message: string } }
  | { ok: false; reason: "invalid"; errors: ContactErrors }
  /** Honeypot filled in or too many links: almost certainly a bot. */
  | { ok: false; reason: "spam" }
  /** Submitted faster than a person can type: ask them to retry rather than dropping the message. */
  | { ok: false; reason: "too_fast" }
  /** The page was left open for a very long time. */
  | { ok: false; reason: "stale" };

export const MIN_FILL_MS = 3_000;
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
export const MAX_LINKS = 2;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function countLinks(text: string): number {
  return (text.match(/https?:\/\/|www\./gi) ?? []).length;
}

/** Validate the fields and apply the spam heuristics. `now` is injected for testing. */
export function checkContact(input: ContactInput, now: number): ContactCheck {
  // Spam signals first, so bots learn nothing about which fields were wrong.
  if (input.website.trim() !== "") return { ok: false, reason: "spam" };
  const age = now - input.startedAt;
  if (!Number.isFinite(age) || age < 0) return { ok: false, reason: "spam" };
  if (age < MIN_FILL_MS) return { ok: false, reason: "too_fast" };
  if (age > MAX_FORM_AGE_MS) return { ok: false, reason: "stale" };

  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();
  const errors: ContactErrors = {};

  if (name.length < 1 || name.length > 100)
    errors.name = "Please enter your name (up to 100 characters).";
  if (!EMAIL.test(email) || email.length > 200)
    errors.email = "Please enter a valid email address.";
  if (message.length < 10) errors.message = "Please write at least 10 characters.";
  else if (message.length > 5_000)
    errors.message = "Please keep your message under 5,000 characters.";

  if (Object.keys(errors).length > 0) return { ok: false, reason: "invalid", errors };
  if (countLinks(message) > MAX_LINKS) return { ok: false, reason: "spam" };
  return { ok: true, value: { name, email, message } };
}

/** Verify a Cloudflare Turnstile token. Returns true if no secret is configured (check disabled). */
export async function verifyTurnstile(
  token: string | null,
  secret: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
