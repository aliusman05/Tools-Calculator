import Link from "next/link";
import { Fragment } from "react";

export type Crumb = { label: string; href?: string };

/** The last crumb is the current page and is rendered without a link. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <ol className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={item.label}>
              <li>
                {item.href && !last ? (
                  <Link
                    href={item.href}
                    className="hover:text-foreground inline-flex min-h-6 items-center underline-offset-2 hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className="text-foreground">
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden="true" role="presentation">
                  /
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
