import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Table that scrolls inside its own container, never the page body. */
export function Table({
  caption,
  children,
  className,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className={cn("rounded-card border-border overflow-x-auto border", className)}
    >
      <table className="w-full min-w-max border-collapse text-left text-sm tabular-nums">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

type Align = "left" | "right";

export function Th({ children, align = "left" }: { children: ReactNode; align?: Align }) {
  return (
    <th
      scope="col"
      className={cn(
        "bg-surface-muted px-4 py-2.5 font-semibold",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = "left" }: { children: ReactNode; align?: Align }) {
  return (
    <td className={cn("border-border border-t px-4 py-2.5", align === "right" && "text-right")}>
      {children}
    </td>
  );
}
