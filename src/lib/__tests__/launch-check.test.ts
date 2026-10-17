import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/** Proves the launch check fails when it should: it is run against a deliberately bad fake site. */

let server: Server | undefined;
afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

type Route = { status?: number; type?: string; body?: string; headers?: Record<string, string> };

async function serve(routes: (base: string) => Record<string, Route>): Promise<string> {
  let table: Record<string, Route> = {};
  server = createServer((req, res) => {
    const r = table[(req.url ?? "/").split("?")[0]!] ?? {
      status: 404,
      type: "text/html",
      body: "<h1>404</h1>",
    };
    res
      .writeHead(r.status ?? 200, { "content-type": r.type ?? "text/html", ...(r.headers ?? {}) })
      .end(r.body ?? "");
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  table = routes(base);
  return base;
}

function run(
  base: string,
): Promise<{ code: number; results: Array<{ status: string; name: string; note: string }> }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [join(process.cwd(), "scripts", "launch-check.mjs"), "--base", base, "--no-source", "--json"],
      { timeout: 60_000, maxBuffer: 5_000_000 },
      (error, stdout) => {
        let results: Array<{ status: string; name: string; note: string }> = [];
        try {
          results = JSON.parse(stdout).results;
        } catch {
          // an unreachable server prints an error instead of JSON
        }
        resolve({ code: error ? ((error as { code?: number }).code ?? 1) : 0, results });
      },
    );
  });
}

const page = (title: string, extra = "") =>
  `<html><head><title>${title}</title></head><body><h1>x</h1>${extra}</body></html>`;

describe("launch-check", () => {
  it("exits 2 when the site cannot be reached", async () => {
    const { code } = await run("http://127.0.0.1:1");
    expect(code).toBe(2);
  });

  it("fails a bad site on duplicates, missing files, missing legal pages and missing headers", async () => {
    const base = await serve((b) => ({
      "/sitemap.xml": {
        type: "application/xml",
        body: `<urlset><url><loc>${b}/</loc></url><url><loc>${b}/a</loc></url></urlset>`,
      },
      "/": { body: page("Same title here") },
      "/a": { body: page("Same title here") },
    }));
    const { code, results } = await run(base);
    expect(code).toBe(1);
    const failed = results.filter((r) => r.status === "FAIL").map((r) => r.name);
    expect(failed.some((n) => /unique title/.test(n))).toBe(true);
    expect(failed.some((n) => /meta description/.test(n))).toBe(true);
    expect(failed.some((n) => /canonical/.test(n))).toBe(true);
    expect(failed.some((n) => /legal pages exist/.test(n))).toBe(true);
    expect(failed.some((n) => /Consent Mode v2 defaults/.test(n))).toBe(true);
    expect(failed.some((n) => /ads\.txt/.test(n))).toBe(true);
    expect(failed.some((n) => /robots\.txt/.test(n))).toBe(true);
    expect(failed.some((n) => /security headers/.test(n))).toBe(true);
    expect(failed.some((n) => /404/.test(n))).toBe(true);
  });

  it("flags a preview-style site that blocks crawlers when production is expected", async () => {
    const base = await serve((b) => ({
      "/sitemap.xml": {
        type: "application/xml",
        body: `<urlset><url><loc>${b}/</loc></url></urlset>`,
      },
      "/": { body: page("Home page title", '<meta name="robots" content="noindex, nofollow"/>') },
      "/robots.txt": { type: "text/plain", body: "User-Agent: *\nDisallow: /\n" },
    }));
    const { results } = await run(base);
    const failed = results.filter((r) => r.status === "FAIL").map((r) => r.name);
    expect(failed.some((n) => /robots\.txt allows crawling/.test(n))).toBe(true);
    expect(failed.some((n) => /pages are indexable/.test(n))).toBe(true);
  });

  it("warns, rather than fails, about a placeholder ads.txt and a localhost sitemap", async () => {
    const base = await serve((b) => ({
      "/sitemap.xml": {
        type: "application/xml",
        body: `<urlset><url><loc>${b}/</loc></url></urlset>`,
      },
      "/": { body: page("Home") },
      "/ads.txt": {
        type: "text/plain",
        body: "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n",
      },
    }));
    const { results } = await run(base);
    const warned = results.filter((r) => r.status === "WARN").map((r) => r.name);
    expect(warned.some((n) => /ads\.txt carries your AdSense publisher ID/.test(n))).toBe(true);
    expect(warned.some((n) => /real domain/.test(n))).toBe(true);
  });

  it("always lists the steps only a person can do", async () => {
    const base = await serve((b) => ({
      "/sitemap.xml": {
        type: "application/xml",
        body: `<urlset><url><loc>${b}/</loc></url></urlset>`,
      },
      "/": { body: page("Home") },
    }));
    const { results } = await run(base);
    const manual = results.filter((r) => r.status === "MANUAL").map((r) => r.name);
    expect(manual.some((n) => /Rich Results/.test(n))).toBe(true);
    expect(manual.some((n) => /Search Console/.test(n))).toBe(true);
    expect(manual.some((n) => /AdSense application/.test(n))).toBe(true);
  });
});
