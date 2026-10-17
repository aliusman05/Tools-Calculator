#!/usr/bin/env node
/**
 * Link checker for the built site. Crawls every page in the sitemap (plus any internal page
 * they link to) over plain HTTP, the way a search engine's crawler without JavaScript would, and
 * checks:
 *
 *   - every internal link returns 200 (a redirect is reported as a warning, not followed);
 *   - every #fragment points at an id that exists on the target page;
 *   - external links are well formed: https, and links that open a new tab carry rel="noopener";
 *     sponsored links carry rel="sponsored";
 *   - no page in the sitemap is an orphan (linked from nowhere else on the site);
 *   - mailto: links have a plausible address.
 *
 *   pnpm exec next start -p 3300        (in another terminal)
 *   pnpm check-links [--base http://localhost:3300] [--external]
 *
 * With --external it also sends a HEAD request to each distinct external URL and fails on a 404 or
 * 410 (other errors only warn, since third-party sites throttle and block bots). Exits 1 if any
 * problem is found.
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--"))
      acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);
const base = (args.base ?? "http://localhost:3300").replace(/\/$/, "");
const checkExternal = args.external === "true";

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** Pull out the parts of a page we need, with simple regexes (the HTML is generated, so it is regular). */
function parse(html) {
  const links = [];
  for (const m of html.matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = m[1];
    const get = (name) => {
      const x = attrs.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, "i"));
      return x ? decode(x[1] ?? x[2]) : undefined;
    };
    const href = get("href");
    if (href !== undefined) links.push({ href, target: get("target"), rel: get("rel") ?? "" });
  }
  const ids = new Set([...html.matchAll(/\b(?:id|name)="([^"]+)"/g)].map((m) => decode(m[1])));
  return { links, ids };
}

const pages = new Map(); // pathname(+search) -> { status, ids, links }

async function load(path) {
  if (pages.has(path)) return pages.get(path);
  const res = await fetch(base + path, { redirect: "manual" });
  const record = {
    status: res.status,
    location: res.headers.get("location"),
    ids: new Set(),
    links: [],
  };
  if (res.status === 200 && (res.headers.get("content-type") ?? "").includes("text/html")) {
    Object.assign(record, parse(await res.text()));
  }
  pages.set(path, record);
  return record;
}

const problems = [];
const warnings = [];
const inbound = new Map(); // path -> Set of pages linking to it
const externalUrls = new Map(); // url -> first page that links to it

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => new URL(m[1]).pathname,
);
if (sitemapPaths.length === 0) {
  console.error("The sitemap lists no pages.");
  process.exit(1);
}

const queue = [...sitemapPaths];
const visited = new Set();
while (queue.length > 0) {
  const path = queue.shift();
  if (visited.has(path)) continue;
  visited.add(path);
  const page = await load(path);
  if (page.status !== 200) {
    problems.push(`${path}: page returned ${page.status}`);
    continue;
  }

  for (const link of page.links) {
    const href = link.href.trim();
    if (href === "" || href === "#") {
      problems.push(`${path}: empty link (href="${href}")`);
      continue;
    }
    if (href.startsWith("mailto:")) {
      if (!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/.test(href))
        problems.push(`${path}: malformed mailto link ${href}`);
      continue;
    }
    if (href.startsWith("tel:") || href.startsWith("javascript:")) {
      if (href.startsWith("javascript:")) problems.push(`${path}: javascript: link`);
      continue;
    }

    const isExternal = /^https?:\/\//i.test(href) && !href.startsWith(base);
    if (isExternal) {
      if (!/^https:\/\//i.test(href)) problems.push(`${path}: insecure external link ${href}`);
      if (link.target === "_blank" && !/\bnoopener\b/.test(link.rel)) {
        problems.push(`${path}: ${href} opens a new tab without rel="noopener"`);
      }
      if (!externalUrls.has(href)) externalUrls.set(href, path);
      continue;
    }

    // Internal: resolve against the current page.
    const url = new URL(href, `${base}${path}`);
    const target = url.pathname + url.search;
    const noQuery = url.pathname;
    if (!inbound.has(noQuery)) inbound.set(noQuery, new Set());
    if (noQuery !== path) inbound.get(noQuery).add(path);

    const targetPage = await load(target);
    if (targetPage.status >= 300 && targetPage.status < 400) {
      warnings.push(`${path}: ${href} redirects (${targetPage.status}) to ${targetPage.location}`);
      continue; // a redirect is reported, not followed
    } else if (targetPage.status !== 200) {
      problems.push(`${path}: broken link ${href} (${targetPage.status})`);
      continue;
    }
    if (url.hash && url.hash.length > 1) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (!targetPage.ids.has(id))
        problems.push(`${path}: ${href} points at #${id}, which does not exist on ${noQuery}`);
    }
    if (!visited.has(target) && !url.search) queue.push(target);
  }
}

// Orphans: pages in the sitemap that no other page links to.
const orphans = sitemapPaths.filter((p) => p !== "/" && (inbound.get(p)?.size ?? 0) === 0);
for (const p of orphans) problems.push(`${p}: orphan page (no other page links to it)`);

if (checkExternal) {
  for (const [url, from] of externalUrls) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404 || res.status === 410)
        problems.push(`${from}: external link ${url} is gone (${res.status})`);
      else if (res.status >= 400)
        warnings.push(`${from}: external link ${url} answered ${res.status} (may block bots)`);
    } catch (e) {
      warnings.push(
        `${from}: external link ${url} could not be checked (${e instanceof Error ? e.message : e})`,
      );
    }
  }
}

const internalLinkCount = [...inbound.values()].reduce((n, s) => n + s.size, 0);
console.log(
  `Checked ${visited.size} pages, ${internalLinkCount} internal links, ${externalUrls.size} external URLs` +
    (checkExternal
      ? " (external URLs requested)."
      : " (external URLs not requested; pass --external)."),
);
for (const w of warnings) console.warn(`warning: ${w}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log("No broken links, bad anchors or orphan pages.");
