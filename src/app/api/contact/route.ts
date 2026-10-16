import { NextResponse } from "next/server";
import { checkContact, verifyTurnstile } from "@/lib/contact";

/**
 * Contact form endpoint. Spam checks run first, then the message is forwarded as JSON to
 * CONTACT_WEBHOOK_URL (a form service, Zapier/Make hook, or your own endpoint). With no webhook
 * configured the route answers 503 so the form can fall back to the email link instead of losing
 * the message silently.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const str = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  const check = checkContact(
    {
      name: str("name"),
      email: str("email"),
      message: str("message"),
      website: str("website"),
      startedAt: Number(body.startedAt),
    },
    Date.now(),
  );

  if (!check.ok && check.reason === "spam") {
    // Pretend success so bots do not adapt; nothing is sent.
    return NextResponse.json({ ok: true });
  }
  if (!check.ok && check.reason === "too_fast") {
    return NextResponse.json(
      { ok: false, error: "That was quick. Please wait a few seconds and send it again." },
      { status: 429 },
    );
  }
  if (!check.ok && check.reason === "stale") {
    return NextResponse.json(
      {
        ok: false,
        error: "This page has been open for a long time. Please reload it and try again.",
      },
      { status: 400 },
    );
  }
  if (!check.ok) {
    return NextResponse.json({ ok: false, errors: check.errors }, { status: 422 });
  }

  const human = await verifyTurnstile(
    str("turnstileToken") || null,
    process.env.TURNSTILE_SECRET_KEY,
  );
  if (!human) {
    return NextResponse.json(
      { ok: false, error: "The spam check failed. Please reload the page and try again." },
      { status: 400 },
    );
  }

  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json(
      { ok: false, error: "Messages cannot be sent from this form right now.", fallback: "email" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...check.value, receivedAt: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`webhook responded ${res.status}`);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "We could not deliver your message. Please try again or email us.",
        fallback: "email",
      },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
