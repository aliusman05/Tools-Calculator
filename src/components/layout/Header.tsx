import Link from "next/link";
import { categories, getSummaries } from "@/lib/registry";
import { siteConfig } from "@/lib/site-config";
import { MobileMenu } from "./MobileMenu";
import { SearchBox } from "./SearchBox";

export function Header() {
  const items = getSummaries();
  const navCategories = categories.map(({ id, name }) => ({ id, name }));

  return (
    <header className="border-border bg-surface/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex min-h-11 items-center text-lg font-bold tracking-tight">
          <span className="text-accent">{siteConfig.name}</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {navCategories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/category/${c.id}`}
                  className="rounded-control text-muted hover:bg-surface-muted hover:text-foreground inline-flex min-h-11 items-center px-2.5 text-sm font-medium"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <SearchBox
          items={items}
          landmarkLabel="Site search"
          className="ml-auto hidden w-64 md:block"
        />
        <div className="ml-auto md:hidden">
          <MobileMenu categories={navCategories} items={items} />
        </div>
      </div>
    </header>
  );
}
