import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Card } from "@/components/ui/Card";
import { formatIsoDate } from "@/lib/format";
import type { InfoPage } from "@/lib/pages";
import { breadcrumbSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

/** Shared frame for the About, Privacy, Terms, Disclaimer and Contact pages. */
export function LegalPage({
  page,
  showUpdated = true,
  children,
}: {
  page: Pick<InfoPage, "path" | "title">;
  showUpdated?: boolean;
  children: ReactNode;
}) {
  const { reviewed, lastUpdated } = siteConfig.legal;
  return (
    <article>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: page.title, path: page.path },
        ])}
      />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.title }]} />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
      {showUpdated && (
        <p className="text-muted mt-2 text-sm">Last updated {formatIsoDate(lastUpdated)}</p>
      )}
      {!reviewed && (
        <Card role="note" className="border-danger mt-6 max-w-3xl">
          <p className="font-semibold">Template: review before launch</p>
          <p className="text-muted mt-1 text-sm">
            This page was written as a template. Replace the placeholders in square brackets, have
            it reviewed for your jurisdiction, then set <code>legal.reviewed</code> to{" "}
            <code>true</code> in <code>src/lib/site-config.ts</code> to remove this notice.
          </p>
        </Card>
      )}
      <div className="mt-6">{children}</div>
    </article>
  );
}
