import Link from "next/link";
import { ConsentSettingsButton } from "@/components/consent/ConsentSettingsButton";
import { categories } from "@/lib/registry";
import { siteConfig } from "@/lib/site-config";

const legalLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/disclaimer", label: "Disclaimer" },
];

const linkClass = "inline-flex min-h-11 items-center text-sm text-muted hover:text-foreground";

export function Footer() {
  return (
    <footer className="border-border bg-surface mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-accent text-lg font-bold">{siteConfig.name}</p>
          <p className="text-muted mt-2 max-w-xs text-sm">
            Free personal finance calculators. Every calculation runs in your browser and your
            numbers are never sent to a server.
          </p>
        </div>
        <nav aria-label="Calculator categories">
          <h2 className="text-sm font-semibold">Calculators</h2>
          <ul className="mt-1">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.id}`} className={linkClass}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Legal and site information">
          <h2 className="text-sm font-semibold">Site</h2>
          <ul className="mt-1">
            {legalLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <ConsentSettingsButton className={linkClass} />
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-border border-t">
        <p className="text-muted mx-auto max-w-6xl px-4 py-4 text-xs">
          For educational purposes only. Results are estimates and are not financial, tax or legal
          advice. © {siteConfig.lastUpdated.slice(0, 4)} {siteConfig.name}.
        </p>
      </div>
    </footer>
  );
}
