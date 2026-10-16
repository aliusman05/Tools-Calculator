"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: string; content: ReactNode };

export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const uid = useId();
  const [active, setActive] = useState(items[0]?.id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    const target = items[next];
    if (!target) return;
    setActive(target.id);
    refs.current[target.id]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="border-border flex gap-1 overflow-x-auto border-b"
      >
        {items.map((item, i) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[item.id] = el;
              }}
              role="tab"
              type="button"
              id={`${uid}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "-mb-px min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold",
                selected
                  ? "border-accent text-accent"
                  : "text-muted hover:text-foreground border-transparent",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${uid}-panel-${item.id}`}
          aria-labelledby={`${uid}-tab-${item.id}`}
          hidden={item.id !== active}
          tabIndex={0}
          className="pt-4"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
