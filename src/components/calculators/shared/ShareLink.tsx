"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { currentShareUrl } from "@/lib/share-store";

type Status = "idle" | "copied" | "manual";

/**
 * "Copy link": copies a URL carrying the current inputs, so a result can be shared or bookmarked.
 * The address bar itself never holds the inputs. Where the Clipboard API is unavailable (older
 * browsers, or a page that is not served over HTTPS) the link is shown in a field, already selected,
 * so it can be copied by hand.
 */
export function ShareLink() {
  const [status, setStatus] = useState<Status>("idle");
  const [url, setUrl] = useState("");
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  async function copy() {
    const link = currentShareUrl();
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(link);
      setStatus("copied");
      timer.current = window.setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setUrl(link);
      setStatus("manual");
      window.requestAnimationFrame(() => field.current?.select());
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="share-link">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={copy}>
          Copy link
        </Button>
        <span role="status" aria-live="polite" className="text-muted text-sm">
          {status === "copied" && "Link copied"}
          {status === "manual" && "Copy this link yourself (Ctrl+C or long-press)"}
        </span>
      </div>
      {status === "manual" && (
        <div className="flex flex-col gap-1">
          <label htmlFor={fieldId} className="text-sm font-medium">
            Link with your inputs
          </label>
          <input
            ref={field}
            id={fieldId}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="border-border bg-surface rounded-control w-full border px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}
