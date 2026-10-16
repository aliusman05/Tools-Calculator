import { expect, test, type APIRequestContext } from "@playwright/test";
import { open } from "./support/open";

/** Internal links allowed to return a non-200 status. Empty now that every footer page exists. */
const PENDING_PAGES: string[] = [];

async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
}

test.describe("sitemap and robots", () => {
  test("sitemap.xml is valid XML listing every page", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("xml");
    const xml = await res.text();
    expect(xml).toContain("<urlset");
    const paths = await sitemapPaths(request);
    expect(paths).toContain("/");
    expect(paths).toContain("/mortgage-calculator");
    expect(paths).toContain("/category/loans");
    expect(paths.some((p) => p.startsWith("/search"))).toBe(false);
    expect(paths.length).toBe(24); // home + 5 info pages + 6 categories + 12 calculators
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("robots.txt allows crawling, blocks /search and points to the sitemap", async ({
    request,
  }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/User-Agent: \*/i);
    expect(text).toMatch(/Allow: \//);
    expect(text).toMatch(/Disallow: \/search/);
    expect(text).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });
});

test.describe("every page in the sitemap", () => {
  test("has unique, well-formed SEO metadata, one h1 and valid JSON-LD", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const paths = await sitemapPaths(request);
    const titles = new Map<string, string>();
    const descriptions = new Map<string, string>();

    for (const path of paths) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);

      const title = await page.title();
      expect(title.length, `${path} title "${title}"`).toBeGreaterThan(10);
      expect(title.length, `${path} title "${title}"`).toBeLessThan(60);
      expect(
        titles.has(title),
        `duplicate title "${title}" on ${path} and ${titles.get(title)}`,
      ).toBe(false);
      titles.set(title, path);

      const description =
        (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
      expect(description.length, `${path} description length`).toBeGreaterThanOrEqual(150);
      expect(description.length, `${path} description length`).toBeLessThanOrEqual(160);
      expect(
        descriptions.has(description),
        `duplicate description on ${path} and ${descriptions.get(description)}`,
      ).toBe(false);
      descriptions.set(description, path);

      const canonical = (await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "";
      expect(new URL(canonical).pathname, `${path} canonical`).toBe(path);

      await expect(page.locator('meta[property="og:title"]'), path).toHaveAttribute(
        "content",
        /.+/,
      );
      await expect(page.locator('meta[property="og:description"]'), path).toHaveAttribute(
        "content",
        /.+/,
      );
      await expect(page.locator('meta[property="og:image"]'), path).toHaveAttribute(
        "content",
        /\.(png|jpg)|opengraph-image/,
      );
      await expect(page.locator('meta[name="twitter:card"]'), path).toHaveAttribute(
        "content",
        "summary_large_image",
      );
      await expect(page.locator("h1"), `${path} h1 count`).toHaveCount(1);
      await expect(page.locator('meta[name="robots"][content*="noindex"]'), path).toHaveCount(0);

      const blocks = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
      expect(blocks.length, `${path} JSON-LD blocks`).toBeGreaterThan(0);
      for (const raw of blocks) {
        const data = JSON.parse(raw);
        expect(data["@context"], path).toBe("https://schema.org");
        expect(typeof data["@type"], path).toBe("string");
      }
    }
  });

  test("uses the right schema types per page type", async ({ page }) => {
    const types = async (path: string) => {
      await open(page, path);
      return page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent ?? "{}")["@type"]));
    };
    expect(await types("/")).toEqual(expect.arrayContaining(["WebSite", "Organization"]));
    expect(await types("/category/debt")).toEqual(
      expect.arrayContaining(["CollectionPage", "BreadcrumbList"]),
    );
    expect(await types("/loan-calculator")).toEqual(
      expect.arrayContaining(["WebApplication", "FAQPage", "BreadcrumbList"]),
    );
  });

  test("FAQ schema matches the visible questions", async ({ page }) => {
    await open(page, "/loan-calculator");
    const faq = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) =>
        els.map((el) => JSON.parse(el.textContent ?? "{}")).find((d) => d["@type"] === "FAQPage"),
      );
    const visible = await page.locator("#faq-heading ~ div details summary").allInnerTexts();
    const schemaQuestions: string[] = faq.mainEntity.map((q: { name: string }) => q.name);
    expect(schemaQuestions.length).toBeGreaterThanOrEqual(5);
    expect(visible.map((v) => v.replace(/\s*\+\s*$/, "").trim())).toEqual(schemaQuestions);
  });

  test("the WebSite schema search action points at a working page", async ({ page }) => {
    await open(page, "/");
    const site = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) =>
        els.map((el) => JSON.parse(el.textContent ?? "{}")).find((d) => d["@type"] === "WebSite"),
      );
    const template: string = site.potentialAction.target.urlTemplate;
    expect(template).toContain("{search_term_string}");
    const url = new URL(template.replace("{search_term_string}", "loan"));
    const response = await page.goto(`${url.pathname}${url.search}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("link", { name: /Loan Calculator/ }).first()).toBeVisible();
  });
});

test.describe("open graph images", () => {
  for (const path of [
    "/opengraph-image",
    "/mortgage-calculator/opengraph-image",
    "/category/tax/opengraph-image",
  ]) {
    test(`${path} is a PNG`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      const body = await res.body();
      expect(body.length).toBeGreaterThan(5_000);
      // PNG signature
      expect([...body.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    });
  }

  test("every page's og:image resolves", async ({ page, request }) => {
    test.setTimeout(120_000);
    for (const path of ["/", "/category/loans", "/car-loan-calculator"]) {
      await open(page, path);
      const content =
        (await page.locator('meta[property="og:image"]').getAttribute("content")) ?? "";
      const res = await request.get(new URL(content).pathname);
      expect(res.status(), `${path} -> ${content}`).toBe(200);
    }
  });
});

test.describe("category hubs", () => {
  test("have unique intro content, the calculators in the category and breadcrumbs", async ({
    page,
  }) => {
    await open(page, "/category/debt");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Debt Calculators");
    await expect(page.getByText("High-interest debt works against you")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Credit Card Payoff Calculator/ }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Debt Payoff Planner/ }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  });

  test("link to every calculator in their category", async ({ page }) => {
    const expected: Record<string, string[]> = {
      loans: ["/mortgage-calculator", "/loan-calculator", "/car-loan-calculator"],
      savings: [
        "/compound-interest-calculator",
        "/simple-interest-calculator",
        "/savings-goal-calculator",
      ],
      investing: ["/retirement-calculator", "/roi-calculator"],
      tax: ["/income-tax-calculator"],
      debt: ["/credit-card-payoff-calculator", "/debt-payoff-planner"],
      other: ["/inflation-calculator"],
    };
    for (const [category, hrefs] of Object.entries(expected)) {
      await open(page, `/category/${category}`);
      for (const href of hrefs) {
        await expect(page.locator(`main a[href="${href}"]`), `${category} -> ${href}`).toHaveCount(
          1,
        );
      }
    }
  });
});

test.describe("search", () => {
  test("the search page is noindex and finds calculators", async ({ page }) => {
    await page.goto("/search?q=loan"); // results prefetch many links, so skip the network-idle wait
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: /Car Loan Calculator/ }).first()).toBeVisible();
    await expect(page.getByText(/results? for/)).toBeVisible();
  });

  test("shows a helpful message when nothing matches", async ({ page }) => {
    await page.goto("/search?q=zzzzqq");
    await expect(page.getByText("Nothing matched")).toBeVisible();
  });

  test("pressing Enter in the search box opens the results page or the only match", async ({
    page,
  }) => {
    await open(page, "/");
    const box = page.getByRole("search").first().getByLabel("Search calculators");
    await box.fill("loan");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=loan/);

    await open(page, "/");
    const box2 = page.getByRole("search").first().getByLabel("Search calculators");
    await box2.fill("avalanche");
    await box2.press("Enter");
    await expect(page).toHaveURL(/\/debt-payoff-planner$/);
  });
});

test.describe("internal links", () => {
  test("every internal link on every page resolves ", async ({ page, request }) => {
    test.setTimeout(180_000);
    const paths = await sitemapPaths(request);
    const hrefs = new Set<string>();
    for (const path of paths) {
      await page.goto(path);
      const found = await page
        .locator("a[href^='/']")
        .evaluateAll((els) =>
          els.map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? ""),
        );
      for (const h of found) hrefs.add(h.split("#")[0]!.split("?")[0]!);
    }
    const broken: string[] = [];
    for (const href of hrefs) {
      if (!href || PENDING_PAGES.includes(href)) continue;
      const res = await request.get(href);
      if (res.status() !== 200) broken.push(`${href} -> ${res.status()}`);
    }
    expect(broken).toEqual([]);
  });

  test("calculator pages link to related calculators and their category hub", async ({ page }) => {
    await open(page, "/credit-card-payoff-calculator");
    await expect(page.locator('main a[href="/debt-payoff-planner"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/category/debt"]').first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Related calculators" })).toBeVisible();
  });

  test("URLs have no trailing-slash duplicates", async ({ request }) => {
    const res = await request.get("/loan-calculator/", { maxRedirects: 0 });
    expect([200, 301, 308]).toContain(res.status());
    if (res.status() !== 200) expect(res.headers()["location"]).toMatch(/\/loan-calculator$/);
  });
});
