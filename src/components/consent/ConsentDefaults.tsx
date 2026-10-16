import { consentInitScript } from "@/lib/consent";

/**
 * Sets Google Consent Mode v2 defaults (everything optional denied) before any other script runs.
 * Render it inside <head>: an inline script there executes synchronously, ahead of every tag.
 */
export function ConsentDefaults() {
  return <script id="consent-defaults" dangerouslySetInnerHTML={{ __html: consentInitScript() }} />;
}
