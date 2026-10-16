import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { categories, getPopularCalculators } from "@/lib/registry";

export default function NotFound() {
  const popular = getPopularCalculators(6);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-10 text-center">
      <p className="text-accent text-6xl font-bold">404</p>
      <h1 className="text-3xl font-bold">We could not find that page</h1>
      <p className="text-muted">
        The page may have moved or the address may be mistyped. Try one of these instead.
      </p>
      <ButtonLink href="/">Go to the home page</ButtonLink>

      {popular.length > 0 && (
        <section aria-labelledby="nf-popular" className="w-full text-left">
          <h2 id="nf-popular" className="mb-2 text-lg font-semibold">
            Popular calculators
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {popular.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/${c.slug}`}
                  className="rounded-control border-border bg-surface hover:border-accent flex min-h-11 items-center border px-3"
                >
                  {c.shortTitle}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="nf-cats" className="w-full text-left">
        <h2 id="nf-cats" className="mb-2 text-lg font-semibold">
          Browse categories
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/category/${c.id}`}
                className="rounded-control border-border bg-surface hover:border-accent flex min-h-11 items-center border px-3"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
