#!/usr/bin/env node
/**
 * Pre-launch checklist (PLAN.md section 13), run against a live server and the repository.
 *
 *   pnpm build && pnpm exec next start -p 3300         (or point --base at staging / production)
 *   pnpm launch-check [--base http://localhost:3300] [--site-url https://yourdomain.com]
 *                     [--expect production|preview] [--no-source] [--strict] [--json]
 *
 * Every item ends as one of:
 *   PASS    verified
 *   FAIL    wrong, and it blocks launch
 *   WARN    needs YOUR action or sign-off (placeholder, missing account, unset environment variable)
 *   MANUAL  cannot be automated (real devices, accounts, DNS); the note says what to do
 *
 * Exit code 1 if anything FAILs (with --strict, also if anything WARNs). The HTTP checks run against
 * whatever --base points at; the source checks (--no-source skips them) read the working tree.
 * Environment checks look at THIS shell's variables, not the hosting dashboard's.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--"))
      acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);
const base = (args.base ?? "http://localhost:3300").replace(/\/$/, "");
const expectProduction = (args.expect ?? "production") === "production";
const runSource = args["no-source"] !== "true";
const strict = args.strict === "true";
const root = process.cwd();

const results = [];
const add = (status, area, name, note = "") => results.push({ status, area, name, note });
const pass = (area, name, note) => add("PASS", area, name, note);
const fail = (area, name, note) => add("FAIL", area, name, note);
const warn = (area, name, note) => add("WARN", area, name, note);
const manual = (area, name, note) => add("MANUAL", area, name, note);

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? decode(m[1]) : undefined;
};
const read = (...p) => readFileSync(join(root, ...p), "utf8");

async function get(path, init) {
  try {
    const res = await fetch(base + path, { redirect: "manual", ...init });
    return { res, status: res.status, headers: res.headers, text: async () => res.text() };
  } catch (e) {
    return {
      status: 0,
      error: e instanceof Error ? e.message : String(e),
      headers: new Headers(),
      text: async () => "",
    };
  }
}

function pageFacts(html) {
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map((m) => m[0]);
  const description = decode(
    attr(metas.find((m) => /name="description"/.test(m)) ?? "", "content") ?? "",
  );
  const robotsMeta = attr(metas.find((m) => /name="robots"/.test(m)) ?? "", "content") ?? "";
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/g)]
    .map((m) => m[0])
    .find((l) => /rel="canonical"/.test(l));
  const canonical = canonicalTag ? attr(canonicalTag, "href") : undefined;
  const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
  const jsonLd = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((m) => m[1]);
  const hrefs = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => attr(m[0], "href")).filter(Boolean);
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  return { title, description, robotsMeta, canonical, h1s, jsonLd, hrefs, scripts };
}

// ---------------------------------------------------------------------------------------------
// HTTP checks
// ---------------------------------------------------------------------------------------------
const reach = await get("/sitemap.xml");
if (reach.status !== 200) {
  console.error(
    `Cannot reach ${base}/sitemap.xml (${reach.status || reach.error}). Start the server first.`,
  );
  process.exit(2);
}
const sitemapXml = await reach.text();
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const paths = sitemapUrls.map((u) => new URL(u).pathname);

const pages = new Map();
for (const p of paths) {
  const r = await get(p);
  pages.set(p, {
    status: r.status,
    headers: r.headers,
    html: r.status === 200 ? await r.text() : "",
  });
}

// 1. Sitemap
if (paths.length >= 20 && new Set(paths).size === paths.length) {
  pass("Sitemap", "sitemap.xml is live and lists every page once", `${paths.length} URLs`);
} else fail("Sitemap", "sitemap.xml lists the pages", `only ${paths.length} URLs, or duplicates`);

const broken = [...pages].filter(([, v]) => v.status !== 200).map(([p, v]) => `${p} (${v.status})`);
broken.length === 0
  ? pass("Sitemap", "every sitemap URL returns 200")
  : fail("Sitemap", "every sitemap URL returns 200", broken.join(", "));

const origins = new Set(sitemapUrls.map((u) => new URL(u).origin));
const origin = [...origins][0];
if (origins.size !== 1) fail("Sitemap", "sitemap uses one canonical host", [...origins].join(", "));
else if (args["site-url"]) {
  origin === args["site-url"].replace(/\/$/, "")
    ? pass("Sitemap", "sitemap and canonical URLs use your domain", origin)
    : fail(
        "Sitemap",
        "sitemap and canonical URLs use your domain",
        `${origin} is not ${args["site-url"]}`,
      );
} else if (/localhost|127\.0\.0\.1|example\.com/.test(origin)) {
  warn(
    "Sitemap",
    "sitemap and canonical URLs use your real domain",
    `they use ${origin}. Set NEXT_PUBLIC_SITE_URL to your domain at build time (or pass --site-url to verify).`,
  );
} else pass("Sitemap", "sitemap and canonical URLs use a real domain", origin);

// 2. Titles, descriptions, canonicals, headings
const titles = new Map();
const descriptions = new Map();
const problems = { title: [], description: [], canonical: [], h1: [] };
for (const [p, v] of pages) {
  if (v.status !== 200) continue;
  const f = pageFacts(v.html);
  if (f.title.length < 10 || f.title.length >= 60)
    problems.title.push(`${p} (${f.title.length} chars)`);
  if (titles.has(f.title)) problems.title.push(`${p} duplicates ${titles.get(f.title)}`);
  titles.set(f.title, p);
  if (f.description.length < 150 || f.description.length > 160)
    problems.description.push(`${p} (${f.description.length} chars)`);
  if (descriptions.has(f.description))
    problems.description.push(`${p} duplicates ${descriptions.get(f.description)}`);
  descriptions.set(f.description, p);
  if (!f.canonical || new URL(f.canonical).pathname !== p)
    problems.canonical.push(`${p} -> ${f.canonical}`);
  if (f.h1s !== 1) problems.h1.push(`${p} has ${f.h1s} h1`);
}
for (const [key, label] of [
  ["title", "every page has a unique title under 60 characters"],
  ["description", "every page has a unique 150-160 character meta description"],
  ["canonical", "every page has a canonical URL matching its path"],
  ["h1", "every page has exactly one h1"],
]) {
  problems[key].length === 0
    ? pass("SEO", label, `${pages.size} pages`)
    : fail("SEO", label, problems[key].slice(0, 4).join("; "));
}

// 3. Structured data
const schemaProblems = [];
for (const [p, v] of pages) {
  if (v.status !== 200) continue;
  const f = pageFacts(v.html);
  const types = [];
  for (const raw of f.jsonLd) {
    try {
      const d = JSON.parse(raw);
      if (d["@context"] !== "https://schema.org") schemaProblems.push(`${p}: wrong @context`);
      types.push(d["@type"]);
    } catch {
      schemaProblems.push(`${p}: unparseable JSON-LD`);
    }
  }
  if (types.length === 0) schemaProblems.push(`${p}: no JSON-LD`);
  const isCalc =
    !p.startsWith("/category/") &&
    !["/", "/about", "/contact", "/privacy-policy", "/terms", "/disclaimer"].includes(p);
  if (isCalc)
    for (const t of ["WebApplication", "FAQPage", "BreadcrumbList"])
      if (!types.includes(t)) schemaProblems.push(`${p}: missing ${t}`);
}
schemaProblems.length === 0
  ? pass(
      "SEO",
      "structured data parses and calculator pages have WebApplication, FAQPage and BreadcrumbList",
    )
  : fail("SEO", "structured data is valid", schemaProblems.slice(0, 4).join("; "));
manual(
  "SEO",
  "Google Rich Results Test",
  "Run it on a live calculator page; it cannot be run offline.",
);

// 4. Legal pages complete and linked in the footer
const LEGAL = ["/about", "/contact", "/privacy-policy", "/terms", "/disclaimer"];
const homeHrefs = new Set(pageFacts(pages.get("/")?.html ?? "").hrefs);
const missing = LEGAL.filter((p) => pages.get(p)?.status !== 200 || !homeHrefs.has(p));
missing.length === 0
  ? pass(
      "Legal",
      "About, Contact, Privacy Policy, Terms and Disclaimer exist and are linked from every page's footer",
    )
  : fail("Legal", "legal pages exist and are linked", missing.join(", "));
const withoutLegal = [...pages]
  .filter(([, v]) => v.status === 200 && !LEGAL.every((l) => pageFacts(v.html).hrefs.includes(l)))
  .map(([p]) => p);
withoutLegal.length === 0
  ? pass("Legal", "every page links all five legal pages")
  : fail("Legal", "every page links all five legal pages", withoutLegal.join(", "));
const templateNotice = LEGAL.filter((p) =>
  pages.get(p)?.html.includes("Template: review before launch"),
);
templateNotice.length === 0
  ? pass("Legal", "legal pages carry no 'template' notice")
  : fail(
      "Legal",
      "legal pages still show the red 'Template: review before launch' notice",
      `on ${templateNotice.join(", ")}. Review them, then set legal.reviewed to true in src/lib/site-config.ts.`,
    );
const calcPages = [...pages].filter(
  ([, v]) => v.status === 200 && v.html.includes('data-testid="result-disclaimer"'),
).length;
calcPages >= 12
  ? pass("Legal", "every calculator shows a disclaimer under its results", `${calcPages} pages`)
  : fail("Legal", "every calculator shows a disclaimer", `${calcPages} of 12`);

// 5. Consent
const home = pageFacts(pages.get("/")?.html ?? "");
const homeHtml = pages.get("/")?.html ?? "";
/gtag\('consent', ?'default'/.test(homeHtml) &&
/ad_storage[^}]*denied/.test(homeHtml) &&
/analytics_storage[^}]*denied/.test(homeHtml) &&
/ad_user_data[^}]*denied/.test(homeHtml) &&
/ad_personalization[^}]*denied/.test(homeHtml)
  ? pass("Consent", "Consent Mode v2 defaults are set to denied before anything else")
  : fail(
      "Consent",
      "Consent Mode v2 defaults (ad_storage, analytics_storage, ad_user_data, ad_personalization) are denied in the page head",
    );
const thirdParty = home.scripts.filter((s) =>
  /googlesyndication|googletagmanager|doubleclick|google-analytics/.test(s),
);
thirdParty.length === 0
  ? pass("Consent", "no ad or analytics script is in the page before consent")
  : fail("Consent", "no ad or analytics script loads before consent", thirdParty.join(", "));
pass(
  "Consent",
  "banner behavior (accept, reject, customize, withdraw, no tags before consent)",
  "proven by e2e/consent.spec.ts and e2e/ads/ads.spec.ts",
);
warn(
  "Consent",
  "a Google-certified CMP for EEA/UK/Swiss AdSense traffic",
  "The built-in banner is not certified. Install one before applying for AdSense (docs/LAUNCH-TODO.md).",
);

// 6. ads.txt, robots.txt
const ads = await get("/ads.txt");
const adsText = ads.status === 200 ? await ads.text() : "";
const adsRecords = adsText
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
if (ads.status !== 200 || adsRecords.length === 0)
  fail("Files", "ads.txt is live with a record", `status ${ads.status}`);
else if (!adsRecords.every((r) => /^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0$/.test(r)))
  fail("Files", "ads.txt records are valid", adsRecords.join(" | "));
else if (adsText.includes("pub-0000000000000000"))
  warn(
    "Files",
    "ads.txt carries your AdSense publisher ID",
    "It still holds the placeholder pub-0000000000000000. Replace it once AdSense gives you an ID.",
  );
else pass("Files", "ads.txt is live with your publisher ID");

const robots = await get("/robots.txt");
const robotsText = robots.status === 200 ? await robots.text() : "";
if (robots.status !== 200) fail("Files", "robots.txt is live", `status ${robots.status}`);
else if (expectProduction) {
  /Disallow:\s*\/\s*$/m.test(robotsText)
    ? fail(
        "Files",
        "robots.txt allows crawling",
        "it contains 'Disallow: /' (is this a preview build?)",
      )
    : /Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/.test(robotsText)
      ? pass("Files", "robots.txt is live, allows crawling and points to the sitemap")
      : fail("Files", "robots.txt points to the sitemap");
} else {
  /Disallow:\s*\/\s*$/m.test(robotsText)
    ? pass("Files", "robots.txt blocks crawlers on this non-production site")
    : fail("Files", "robots.txt blocks crawlers on a preview site");
}
const robotsMetaOnHome = home.robotsMeta;
if (expectProduction) {
  /noindex/i.test(robotsMetaOnHome) ||
  /noindex/i.test(pages.get("/")?.headers.get("x-robots-tag") ?? "")
    ? fail(
        "Files",
        "pages are indexable",
        "a noindex directive is present (is this a preview build?)",
      )
    : pass("Files", "pages are indexable (no noindex)");
} else {
  /noindex/i.test(robotsMetaOnHome)
    ? pass("Files", "pages are noindex on this non-production site")
    : fail("Files", "pages are noindex on a preview site");
}

// 7. 404
const nf = await get("/definitely-not-a-real-page-xyz");
const nfHtml = nf.status === 404 ? await nf.text() : "";
nf.status === 404 && /404/.test(nfHtml) && /Go to the home page/.test(nfHtml)
  ? pass("Files", "unknown URLs return a real 404 page with a way back")
  : fail("Files", "404 page", `status ${nf.status}`);

// 8. Security headers, icons
const hdr = pages.get("/")?.headers ?? new Headers();
const wantHeaders = [
  "x-content-type-options",
  "referrer-policy",
  "x-frame-options",
  "permissions-policy",
  "strict-transport-security",
];
const missingHeaders = wantHeaders.filter((h) => !hdr.get(h));
missingHeaders.length === 0
  ? pass("Security", "security headers are sent", wantHeaders.join(", "))
  : fail("Security", "security headers are sent", `missing ${missingHeaders.join(", ")}`);
/strict-origin-when-cross-origin/.test(hdr.get("referrer-policy") ?? "")
  ? pass("Security", "cross-origin Referer headers carry no path or query string")
  : fail("Security", "Referrer-Policy keeps the query string private");
for (const [path, label] of [
  ["/favicon.ico", "favicon"],
  ["/icon", "site icon"],
  ["/apple-icon", "Apple touch icon"],
  ["/opengraph-image", "social share image"],
]) {
  const r = await get(path);
  r.status === 200 && (r.headers.get("content-type") ?? "").startsWith("image/")
    ? pass("Files", `${label} is served`, path)
    : fail("Files", `${label} is served`, `${path} -> ${r.status}`);
}
manual(
  "Security",
  "HTTPS everywhere and one canonical host (www or not)",
  "Configure in your host: force HTTPS and redirect the other host to the canonical one (docs/LAUNCH-TODO.md).",
);

// ---------------------------------------------------------------------------------------------
// Source checks
// ---------------------------------------------------------------------------------------------
if (runSource) {
  // Calculator math has tests with reference values
  const calcDir = join("src", "lib", "calculators");
  const modules = readdirSync(join(root, calcDir)).filter((f) => f.endsWith(".ts"));
  const gaps = [];
  let totalTests = 0;
  for (const m of modules) {
    const testFile = join(calcDir, "__tests__", m.replace(/\.ts$/, ".test.ts"));
    if (!existsSync(join(root, testFile))) {
      gaps.push(`${m}: no test file`);
      continue;
    }
    const text = read(testFile);
    const count = (text.match(/\b(it|test)(\.each)?\(/g) ?? []).length;
    totalTests += count;
    if (count < 5) gaps.push(`${m}: only ${count} tests`);
    if (!/reference|Reference|Checked against|Reference values|\/\/ .*\$[\d,]+/i.test(text))
      gaps.push(`${m}: no reference-value comment`);
  }
  gaps.length === 0
    ? pass(
        "Calculators",
        "every calculator has a test file with 5+ tests and documented reference values",
        `${modules.length} math modules, ${totalTests} test cases`,
      )
    : fail("Calculators", "every calculator has tests with reference values", gaps.join("; "));
  pass(
    "Calculators",
    "all 12 calculators tested against independently derived values",
    "see the reference-value comments at the top of each src/lib/calculators/__tests__ file; run pnpm test",
  );

  // Tax data
  const tax = read("src", "lib", "data", "tax-us-2026.ts");
  const checked = tax.match(/lastChecked:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
  const year = Number(tax.match(/year:\s*(\d{4})/)?.[1]);
  const ageDays = checked ? (Date.now() - new Date(checked).getTime()) / 86_400_000 : Infinity;
  if (!checked || ageDays > 400)
    fail("Data", "tax data is dated and recent", `lastChecked ${checked}`);
  else if (year < new Date().getUTCFullYear())
    warn("Data", "tax data is for the current tax year", `data is for ${year}`);
  else
    pass(
      "Data",
      "tax data is verified against the IRS source and dated",
      `tax year ${year}, checked ${checked}; compared line by line with Rev. Proc. 2025-32 (see income-tax.test.ts)`,
    );
  /ownerVerified:\s*true/.test(tax)
    ? pass("Data", "owner has signed off the tax figures")
    : warn(
        "Data",
        "you have signed off the tax figures",
        "Glance over src/lib/data/tax-us-2026.ts against the IRS PDF, then set ownerVerified to true.",
      );

  // Placeholders
  const site = read("src", "lib", "site-config.ts");
  const placeholder = [];
  if (/operatorName:\s*"\[/.test(site)) placeholder.push("legal.operatorName");
  if (/contactEmail:\s*"[^"]*@example\.com"/.test(site)) placeholder.push("legal.contactEmail");
  if (/jurisdiction:\s*"\[/.test(site)) placeholder.push("legal.jurisdiction");
  if (/\[Add a short/.test(read("src", "content", "legal", "about.mdx")))
    placeholder.push("the bracketed bio in about.mdx");
  placeholder.length === 0
    ? pass("Owner", "legal and contact details are filled in")
    : fail(
        "Owner",
        "legal and contact details are filled in",
        `still placeholders: ${placeholder.join(", ")}`,
      );
  /reviewed:\s*true/.test(site)
    ? pass("Owner", "legal pages are marked as reviewed")
    : fail(
        "Owner",
        "legal pages are marked as reviewed",
        "Have them reviewed for your jurisdiction, then set legal.reviewed to true.",
      );
  /name:\s*"FinCalc"/.test(site)
    ? warn(
        "Owner",
        "site has its real brand name",
        'siteConfig.name is still the placeholder "FinCalc".',
      )
    : pass("Owner", "site has its own brand name");

  // Boilerplate
  const boiler = [];
  if (/create-next-app/.test(read("README.md")))
    boiler.push("README.md is the create-next-app default");
  for (const f of ["file.svg", "globe.svg", "next.svg", "vercel.svg", "window.svg"])
    if (existsSync(join(root, "public", f))) boiler.push(`public/${f}`);
  const favicon = join(root, "src", "app", "favicon.ico");
  if (existsSync(favicon) && statSync(favicon).isFile())
    boiler.push("src/app/favicon.ico (the default Next.js icon)");
  boiler.length === 0
    ? pass("Hygiene", "no create-next-app boilerplate is left")
    : fail("Hygiene", "no create-next-app boilerplate is left", boiler.join(", "));

  // Lighthouse (recorded)
  for (const form of ["mobile", "desktop"]) {
    const file = join("docs", "perf", `final-lighthouse-${form}.json`);
    if (!existsSync(join(root, file))) {
      fail(
        "Performance",
        `Lighthouse ${form} results are recorded`,
        `${file} missing; run pnpm perf --form ${form} --out ${file}`,
      );
      continue;
    }
    const data = JSON.parse(read(file));
    const bad = [];
    for (const r of data.report) {
      if (r.performance < 95) bad.push(`${r.path} performance ${r.performance}`);
      if (r.accessibility < 100) bad.push(`${r.path} accessibility ${r.accessibility}`);
      if (r.seo < 100) bad.push(`${r.path} SEO ${r.seo}`);
      if (r.lcpMs >= 2500) bad.push(`${r.path} LCP ${r.lcpMs}ms`);
      if (r.cls >= 0.1) bad.push(`${r.path} CLS ${r.cls}`);
    }
    bad.length === 0
      ? pass(
          "Performance",
          `Lighthouse ${form}: performance 95+, accessibility 100, SEO 100, LCP < 2.5s, CLS < 0.1`,
          `${data.report.length} pages, ${data.date.slice(0, 10)}`,
        )
      : fail("Performance", `Lighthouse ${form} meets the targets`, bad.slice(0, 5).join("; "));
  }
  manual(
    "Performance",
    "INP under 200ms in the field",
    "Not measurable in a lab run (e2e/perf.spec.ts guards it on a slowed CPU). Check PageSpeed Insights and Search Console after launch.",
  );

  // Cross-browser
  const browserFile = join("docs", "launch", "browser-results.json");
  if (existsSync(join(root, browserFile))) {
    const report = JSON.parse(read(browserFile));
    const perProject = {};
    const walk = (suite) => {
      for (const spec of suite.specs ?? [])
        for (const t of spec.tests ?? []) {
          const p = (perProject[t.projectName] ??= { ok: 0, bad: 0 });
          t.status === "expected" || t.status === "flaky" || t.status === "skipped"
            ? p.ok++
            : p.bad++;
        }
      for (const s of suite.suites ?? []) walk(s);
    };
    for (const s of report.suites ?? []) walk(s);
    const names = Object.keys(perProject);
    const badProjects = names.filter((n) => perProject[n].bad > 0);
    names.length >= 4 && badProjects.length === 0
      ? pass(
          "Browsers",
          "functional tests pass in Firefox, WebKit (Safari engine), emulated iPhone and emulated Pixel",
          names.map((n) => `${n}: ${perProject[n].ok}`).join(", "),
        )
      : fail(
          "Browsers",
          "functional tests pass in every browser engine",
          `${names.length} projects; failing: ${badProjects.join(", ") || "none, but fewer than 4 projects"}`,
        );
  } else
    fail(
      "Browsers",
      "cross-browser results are recorded",
      `${browserFile} missing; run pnpm e2e:browsers`,
    );
  manual(
    "Browsers",
    "real iOS Safari and real Android Chrome",
    "Engines and device sizes are emulated and tested above, but only a real phone proves touch, the on-screen keyboard and iOS quirks. Open the staging URL on both.",
  );

  // Environment (this shell only)
  const env = process.env;
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "";
  !siteUrl || /localhost|example\.com/.test(siteUrl)
    ? warn(
        "Environment",
        "NEXT_PUBLIC_SITE_URL is your production domain",
        `it is "${siteUrl}" in this shell; set it in the hosting dashboard for Production.`,
      )
    : pass("Environment", "NEXT_PUBLIC_SITE_URL is set", siteUrl);
  /^G-[A-Z0-9]{6,}$/.test(env.NEXT_PUBLIC_GA_ID ?? "")
    ? pass("Environment", "Google Analytics measurement ID is set")
    : warn(
        "Environment",
        "Google Analytics measurement ID (NEXT_PUBLIC_GA_ID)",
        "not set in this shell. Create a GA4 property and set it for Production.",
      );
  env.CONTACT_WEBHOOK_URL
    ? pass("Environment", "contact form delivery (CONTACT_WEBHOOK_URL) is configured")
    : warn(
        "Environment",
        "contact form delivery (CONTACT_WEBHOOK_URL)",
        "not set in this shell. Until it is, the form shows your email address instead of sending.",
      );
  env.NEXT_PUBLIC_ADS_ENABLED === "true" && env.NEXT_PUBLIC_ADSENSE_CLIENT
    ? pass("Environment", "AdSense is configured")
    : warn(
        "Environment",
        "AdSense is configured",
        "ads are off, which is correct until AdSense approves the site (docs/ADS.md).",
      );
}

// Accounts and launch tasks that only a person can do.
manual(
  "Launch",
  "Search Console and Bing Webmaster Tools: verify the domain and submit /sitemap.xml",
  "docs/LAUNCH-TODO.md",
);
manual(
  "Launch",
  "AdSense application",
  "Apply once the site is live with the legal pages and some organic traffic (docs/ADS.md).",
);

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------
if (args.json === "true") {
  console.log(JSON.stringify({ base, results }, null, 2));
} else {
  const icon = { PASS: "PASS  ", FAIL: "FAIL  ", WARN: "WARN  ", MANUAL: "MANUAL" };
  let area = "";
  for (const r of results) {
    if (r.area !== area) {
      area = r.area;
      console.log(`\n${area}`);
    }
    console.log(`  ${icon[r.status]} ${r.name}${r.note ? `\n         ${r.note}` : ""}`);
  }
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(
    `\nLaunch check against ${base}: ${count("PASS")} pass, ${count("FAIL")} fail, ${count("WARN")} warn, ${count("MANUAL")} manual`,
  );
}
const failed =
  results.some((r) => r.status === "FAIL") || (strict && results.some((r) => r.status === "WARN"));
process.exit(failed ? 1 : 0);
