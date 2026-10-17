import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Proves the link checker (scripts/check-links.mjs) actually catches problems: it is run against
 * small fake sites, one healthy and one broken in every way it knows about.
 */

type Site = Record<
  string,
  { status?: number; body?: string; type?: string; headers?: Record<string, string> }
>;

let server: Server | undefined;

async function serve(site: Site): Promise<string> {
  server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0]!;
    const page = site[path];
    if (!page) {
      res.writeHead(404, { "content-type": "text/html" }).end("<h1>Not found</h1>");
      return;
    }
    res
      .writeHead(page.status ?? 200, {
        "content-type": page.type ?? "text/html",
        ...(page.headers ?? {}),
      })
      .end(page.body ?? "");
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

const sitemap = (base: string, paths: string[]) => ({
  "/sitemap.xml": {
    type: "application/xml",
    body: `<urlset>${paths.map((p) => `<url><loc>${base}${p}</loc></url>`).join("")}</urlset>`,
  },
});

function run(base: string, extra: string[] = []): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [join(process.cwd(), "scripts", "check-links.mjs"), "--base", base, ...extra],
      { timeout: 30_000 },
      (error, stdout, stderr) => {
        resolve({
          code: error ? ((error as { code?: number }).code ?? 1) : 0,
          out: stdout + stderr,
        });
      },
    );
  });
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

/** Build a site whose sitemap lists every page, using a placeholder for the port. */
async function makeSite(pages: Record<string, string>): Promise<string> {
  // Start with an empty server just to learn the port, then fill the real routes in.
  const site: Site = {};
  const base = await serve(site);
  for (const [path, body] of Object.entries(pages)) site[path] = { body };
  Object.assign(site, sitemap(base, Object.keys(pages)));
  return base;
}

describe("check-links script", () => {
  it("passes a healthy site", async () => {
    const base = await makeSite({
      "/": '<a href="/a">A</a><a href="/b#part">B</a><a href="mailto:me@example.com">mail</a>',
      "/a": '<a href="/">home</a><a href="/b">b</a>',
      "/b": '<h2 id="part">Part</h2><a href="/">home</a><a href="https://example.com/x" target="_blank" rel="noopener noreferrer">x</a>',
    });
    const { code, out } = await run(base);
    expect(out).toContain("No broken links");
    expect(code).toBe(0);
    expect(out).toMatch(/Checked 3 pages/);
  });

  it("fails on a broken internal link and names the page and the link", async () => {
    const base = await makeSite({
      "/": '<a href="/gone">gone</a>',
      "/other": '<a href="/">home</a>',
    });
    const { code, out } = await run(base);
    expect(code).toBe(1);
    expect(out).toContain("/: broken link /gone (404)");
  });

  it("fails on a #fragment that does not exist on the target page", async () => {
    const base = await makeSite({
      "/": '<a href="/b#missing">b</a>',
      "/b": '<h2 id="present">x</h2><a href="/">home</a>',
    });
    const { code, out } = await run(base);
    expect(code).toBe(1);
    expect(out).toContain("points at #missing");
  });

  it("accepts a #fragment that exists, including on the same page", async () => {
    const base = await makeSite({
      "/": '<a href="#top">top</a><h1 id="top">Top</h1><a href="/b#ok">b</a>',
      "/b": '<h2 id="ok">ok</h2><a href="/">home</a>',
    });
    const { code } = await run(base);
    expect(code).toBe(0);
  });

  it("fails on a page in the sitemap that nothing links to (an orphan)", async () => {
    const base = await makeSite({
      "/": '<a href="/a">a</a>',
      "/a": '<a href="/">home</a>',
      "/lonely": "<p>hi</p>",
    });
    const { code, out } = await run(base);
    expect(code).toBe(1);
    expect(out).toContain("/lonely: orphan page");
  });

  it("fails on empty, javascript: and malformed mailto links", async () => {
    const base = await makeSite({
      "/": '<a href="">empty</a><a href="#">hash</a><a href="javascript:void(0)">js</a><a href="mailto:nope">mail</a>',
    });
    const { code, out } = await run(base);
    expect(code).toBe(1);
    expect(out).toMatch(/empty link/);
    expect(out).toMatch(/javascript: link/);
    expect(out).toMatch(/malformed mailto/);
  });

  it("fails on insecure external links and new-tab links without rel=noopener", async () => {
    const base = await makeSite({
      "/": '<a href="http://insecure.example/x">x</a><a href="https://ok.example/y" target="_blank">y</a>',
    });
    const { code, out } = await run(base);
    expect(code).toBe(1);
    expect(out).toContain("insecure external link http://insecure.example/x");
    expect(out).toContain('opens a new tab without rel="noopener"');
  });

  it("warns, but does not fail, on a redirect", async () => {
    const site: Site = {};
    const base = await serve(site);
    site["/"] = { body: '<a href="/old">old</a><a href="/new">new</a>' };
    site["/new"] = { body: '<a href="/">home</a>' };
    site["/old"] = { status: 301, headers: { location: "/new" } };
    Object.assign(site, sitemap(base, ["/", "/new"]));
    const { code, out } = await run(base);
    expect(out).toMatch(/warning: \/: \/old redirects \(301\)/);
    expect(code).toBe(0);
  });

  it("fails when a sitemap page itself returns an error", async () => {
    const site: Site = {};
    const base = await serve(site);
    site["/"] = { body: "<p>hi</p>" };
    site["/broken"] = { status: 500, body: "boom" };
    Object.assign(site, sitemap(base, ["/", "/broken"]));
    const { code, out } = await run(base);
    expect(code).toBe(1);
    expect(out).toContain("/broken: page returned 500");
  });

  it("fails when the sitemap is empty", async () => {
    const site: Site = {};
    const base = await serve(site);
    Object.assign(site, sitemap(base, []));
    const { code, out } = await run(base);
    expect(code).toBe(1);
    expect(out).toContain("sitemap lists no pages");
  });

  it("decodes HTML entities in links", async () => {
    const base = await makeSite({
      "/": '<a href="/search?a=1&amp;b=2">s</a>',
      "/search": '<a href="/">home</a>',
    });
    const { code } = await run(base);
    expect(code).toBe(0);
  });
});
