#!/usr/bin/env node
/**
 * First-load JavaScript and CSS per route, measured the way a browser sees it: fetch each page
 * from the running production server, collect the scripts and styles it references, and add up
 * their gzipped sizes. Shared chunks are counted once per page.
 *
 *   pnpm exec next start -p 3300        (in another terminal)
 *   pnpm bundle-report [--base http://localhost:3300] [--out perf-reports/bundle.json]
 *                      [--budget-js 200]   exit with an error if any route exceeds this many KB (gzip)
 *
 * Also lists the biggest individual chunks so it is obvious what to split or remove.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gzipSync } from "node:zlib";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--"))
      acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);
const base = args.base ?? "http://localhost:3300";
const out = args.out ?? "perf-reports/bundle.json";

const sitemapXml = await (await fetch(`${base}/sitemap.xml`)).text();
const paths = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

const sizeCache = new Map();
async function gzipSize(url) {
  if (!sizeCache.has(url)) {
    const res = await fetch(base + url);
    const buf = Buffer.from(await res.arrayBuffer());
    sizeCache.set(url, { raw: buf.length, gzip: gzipSync(buf).length });
  }
  return sizeCache.get(url);
}

const kb = (n) => Math.round((n / 1024) * 10) / 10;
const rows = [];
const chunkUse = new Map();

for (const path of paths) {
  const html = await (await fetch(base + path)).text();
  const js = new Set(
    [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)[^"]*"/g)].map((m) => m[1]),
  );
  const css = new Set(
    [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)[^"]*"/g)].map((m) => m[1]),
  );
  let jsGzip = 0;
  let cssGzip = 0;
  for (const u of js) {
    jsGzip += (await gzipSize(u)).gzip;
    chunkUse.set(u, (chunkUse.get(u) ?? 0) + 1);
  }
  for (const u of css) cssGzip += (await gzipSize(u)).gzip;
  rows.push({
    path,
    scripts: js.size,
    jsKb: kb(jsGzip),
    cssKb: kb(cssGzip),
    htmlKb: kb(gzipSync(html).length),
  });
}

console.log("route".padEnd(40), "scripts", "JS gz KB", "CSS gz KB", "HTML gz KB");
for (const r of rows) {
  console.log(
    r.path.padEnd(40),
    String(r.scripts).padStart(7),
    String(r.jsKb).padStart(8),
    String(r.cssKb).padStart(9),
    String(r.htmlKb).padStart(10),
  );
}

const chunks = [...chunkUse.entries()]
  .map(([url, pages]) => ({
    url,
    pages,
    gzipKb: kb(sizeCache.get(url).gzip),
    rawKb: kb(sizeCache.get(url).raw),
  }))
  .sort((a, b) => b.gzipKb - a.gzipKb);
console.log("\nLargest chunks (gzip):");
for (const c of chunks.slice(0, 10))
  console.log(
    `${String(c.gzipKb).padStart(7)} KB gz  ${String(c.rawKb).padStart(7)} KB raw  on ${String(c.pages).padStart(2)} pages  ${c.url}`,
  );

const calc = rows.filter(
  (r) =>
    !r.path.startsWith("/category") &&
    !["/", "/about", "/contact", "/privacy-policy", "/terms", "/disclaimer"].includes(r.path),
);
const avg = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
const summary = {
  calculatorAvgJsKb: avg(calc.map((r) => r.jsKb)),
  maxJsKb: Math.max(...rows.map((r) => r.jsKb)),
  homeJsKb: rows.find((r) => r.path === "/")?.jsKb,
};
console.log("\nSummary:", summary);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  JSON.stringify(
    { date: new Date().toISOString(), summary, rows, chunks: chunks.slice(0, 15) },
    null,
    2,
  ),
);
console.log(`Wrote ${out}`);

if (args["budget-js"]) {
  const budget = Number(args["budget-js"]);
  const over = rows.filter((r) => r.jsKb > budget);
  if (over.length > 0) {
    console.error(`\nOVER BUDGET (${budget} KB gzip of JavaScript):`);
    for (const r of over) console.error(`  ${r.path}: ${r.jsKb} KB`);
    process.exit(1);
  }
  console.log(`Budget OK: every route is within ${budget} KB of JavaScript (gzip).`);
}
