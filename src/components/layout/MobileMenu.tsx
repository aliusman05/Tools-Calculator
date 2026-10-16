"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SearchBox } from "./SearchBox";
import type { CalculatorSummary } from "@/lib/registry";

type NavCategory = { id: string; name: string };

export function MobileMenu({
  categories,
  items,
}: {
  categories: NavCategory[];
  items: CalculatorSummary[];
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("input, a")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="rounded-control border-border bg-surface inline-flex min-h-11 min-w-11 items-center justify-center border px-3 text-sm font-semibold"
      >
        {open ? "Close" : "Menu"}
      </button>
      <div
        id="mobile-menu"
        ref={panelRef}
        hidden={!open}
        className="border-border bg-surface absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b p-4 shadow-lg"
      >
        <SearchBox items={items} className="mb-4" />
        <nav aria-label="Calculator categories">
          <ul className="flex flex-col">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/category/${c.id}`}
                  onClick={() => setOpen(false)}
                  className="rounded-control hover:bg-surface-muted flex min-h-11 items-center px-2 font-medium"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
