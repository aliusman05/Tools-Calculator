#!/usr/bin/env node
/**
 * Lighthouse runner for the production build.
 *
 *   pnpm build && pnpm exec next start -p 3300      (in one terminal)
 *   pnpm perf [--base http://localhost:3300] [--runs 3] [--form mobile|desktop|both]
 *             [--paths /,/mortgage-calculator,...] [--out perf-reports/latest.json]
 *
 * Uses the Chromium that Playwright installed, so no separate Chrome is needed. For each page it
 * runs Lighthouse `--runs` times and reports the MEDIAN of each score and metric, because single
 * runs vary by a few points. Fresh profile each time, so the cookie banner is present, as it is
 * for a first-time visitor.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--"))
      acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);

const base = args.base ?? "http://localhost:3300";
const runs = Number(args.runs ?? 3);
const forms = args.form === "both" ? ["mobile", "desktop"] : [args.form ?? "mobile"];
const paths = (
  args.paths ??
  "/,/mortgage-calculator,/debt-payoff-planner,/compound-interest-calculator,/category/loans,/about"
).split(",");
const out = args.out ?? "perf-reports/latest.json";

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const desktopConfig = {
  extends: "lighthouse:default",
  settings: {
    formFactor: "desktop",
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    throttlingMethod: "simulate",
  },
};

async function runOnce(url, form) {
  const chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
      form === "desktop" ? desktopConfig : undefined,
    );
    const { lhr } = result;
    const a = lhr.audits;
    return {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories["best-practices"].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100),
      lcp: a["largest-contentful-paint"].numericValue,
      cls: a["cumulative-layout-shift"].numericValue,
      tbt: a["total-blocking-time"].numericValue,
      fcp: a["first-contentful-paint"].numericValue,
      si: a["speed-index"].numericValue,
      transferKb: a["total-byte-weight"].numericValue / 1024,
      failedA11y: Object.values(a)
        .filter(
          (x) =>
            x.scoreDisplayMode === "binary" &&
            x.score === 0 &&
            lhr.categories.accessibility.auditRefs.some((r) => r.id === x.id),
        )
        .map((x) => x.id),
      lcpElement:
        a[
          "largest-contentful-paint-element"
        ]?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 80) ?? "",
    };
  } finally {
    await chrome.kill();
  }
}

const report = [];
for (const form of forms) {
  for (const path of paths) {
    const samples = [];
    for (let i = 0; i < runs; i++) samples.push(await runOnce(base + path, form));
    const row = {
      form,
      path,
      performance: median(samples.map((s) => s.performance)),
      accessibility: median(samples.map((s) => s.accessibility)),
      bestPractices: median(samples.map((s) => s.bestPractices)),
      seo: median(samples.map((s) => s.seo)),
      lcpMs: Math.round(median(samples.map((s) => s.lcp))),
      cls: Number(median(samples.map((s) => s.cls)).toFixed(3)),
      tbtMs: Math.round(median(samples.map((s) => s.tbt))),
      fcpMs: Math.round(median(samples.map((s) => s.fcp))),
      speedIndexMs: Math.round(median(samples.map((s) => s.si))),
      transferKb: Math.round(median(samples.map((s) => s.transferKb))),
      failedA11y: [...new Set(samples.flatMap((s) => s.failedA11y))],
      lcpElement: samples[0].lcpElement,
      allPerformanceScores: samples.map((s) => s.performance),
    };
    report.push(row);
    console.log(
      `${form.padEnd(7)} ${path.padEnd(34)} perf ${String(row.performance).padStart(3)} a11y ${String(row.accessibility).padStart(3)} bp ${String(row.bestPractices).padStart(3)} seo ${String(row.seo).padStart(3)} | LCP ${row.lcpMs}ms CLS ${row.cls} TBT ${row.tbtMs}ms | ${row.transferKb}KB` +
        (row.failedA11y.length ? ` | a11y: ${row.failedA11y.join(",")}` : ""),
    );
  }
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), base, runs, report }, null, 2));
console.log(`\nWrote ${out}`);
