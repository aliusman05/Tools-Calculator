#!/usr/bin/env node
/**
 * A/B Lighthouse comparison that is fair on a noisy machine: runs the two variants ALTERNATELY
 * (A, B, A, B, ...) so both experience the same background load, then reports the median of each.
 *
 *   node scripts/ab.mjs --a http://localhost:3300 --b http://localhost:3301 \
 *       --paths /mortgage-calculator,/about --runs 7 [--form mobile|desktop]
 */
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
const A = args.a ?? "http://localhost:3300";
const B = args.b ?? "http://localhost:3301";
const runs = Number(args.runs ?? 5);
const form = args.form ?? "mobile";
const paths = (args.paths ?? "/mortgage-calculator,/about").split(",");

const median = (xs) => {
  const s = [...xs].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const desktop = {
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

async function once(url) {
  const chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const { lhr } = await lighthouse(
      url,
      { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] },
      form === "desktop" ? desktop : undefined,
    );
    const a = lhr.audits;
    return {
      perf: Math.round(lhr.categories.performance.score * 100),
      lcp: a["largest-contentful-paint"].numericValue,
      tbt: a["total-blocking-time"].numericValue,
      cls: a["cumulative-layout-shift"].numericValue,
      fcp: a["first-contentful-paint"].numericValue,
      kb: a["total-byte-weight"].numericValue / 1024,
    };
  } finally {
    await chrome.kill();
  }
}

for (const path of paths) {
  const res = { A: [], B: [] };
  for (let i = 0; i < runs; i++) {
    res.A.push(await once(A + path));
    res.B.push(await once(B + path));
  }
  console.log(`\n${form} ${path}  (${runs} alternating runs, medians)`);
  for (const k of ["A", "B"]) {
    const r = res[k];
    console.log(
      `  ${k}: perf ${median(r.map((x) => x.perf))} [${r.map((x) => x.perf).join("/")}]  LCP ${Math.round(median(r.map((x) => x.lcp)))}ms  FCP ${Math.round(median(r.map((x) => x.fcp)))}ms  TBT ${Math.round(median(r.map((x) => x.tbt)))}ms  CLS ${median(r.map((x) => x.cls)).toFixed(3)}  ${Math.round(median(r.map((x) => x.kb)))}KB`,
    );
  }
}
