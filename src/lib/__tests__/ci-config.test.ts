import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/**
 * Guards against CI drifting out of step with the repository: a workflow that calls a script that
 * no longer exists, runs steps in the wrong order, or uses a different Node than the project. A
 * broken workflow only shows itself after a push, so check it here.
 */

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  if?: string;
};
type Job = { "runs-on": string; "timeout-minutes"?: number; steps: Step[] };
type Workflow = {
  on: { push?: { branches?: string[] }; pull_request?: unknown };
  permissions?: Record<string, string>;
  concurrency?: { group: string; "cancel-in-progress": boolean };
  env?: Record<string, string>;
  jobs: Record<string, Job>;
};

const workflow = parse(read(".github", "workflows", "ci.yml")) as Workflow;
const pkg = JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
  engines?: { node?: string };
  packageManager?: string;
};

const runLines = (job: Job) =>
  job.steps.flatMap((s) =>
    (s.run ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
const indexOfRun = (job: Job, needle: string) => runLines(job).findIndex((l) => l.includes(needle));

describe("workflow shape", () => {
  it("runs on pushes to main and on every pull request", () => {
    expect(workflow.on.push?.branches).toContain("main");
    expect(workflow.on).toHaveProperty("pull_request");
  });

  it("has least-privilege permissions and cancels superseded runs", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(true);
  });

  it("defines the three jobs", () => {
    expect(Object.keys(workflow.jobs).sort()).toEqual(["check", "e2e", "e2e-ads"]);
  });

  it.each(Object.entries(workflow.jobs))(
    "job %s is bounded, on Linux, and set up the same way",
    (_name, job) => {
      expect(job["runs-on"]).toBe("ubuntu-latest");
      expect(job["timeout-minutes"]).toBeGreaterThan(0);
      expect(job["timeout-minutes"]).toBeLessThanOrEqual(30);
      const uses = job.steps.map((s) => s.uses ?? "");
      expect(uses.some((u) => u.startsWith("actions/checkout@"))).toBe(true);
      expect(uses.some((u) => u.startsWith("pnpm/action-setup@"))).toBe(true);
      const node = job.steps.find((s) => s.uses?.startsWith("actions/setup-node@"));
      expect(node?.with?.["node-version-file"]).toBe(".nvmrc");
      expect(node?.with?.cache).toBe("pnpm");
      expect(runLines(job)).toContain("pnpm install --frozen-lockfile");
    },
  );

  it("pins every action to a major version tag", () => {
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) {
        if (step.uses) expect(step.uses, step.uses).toMatch(/@v\d+$/);
      }
    }
  });
});

describe("workflow commands exist", () => {
  const BUILT_IN = new Set(["install", "exec", "dlx", "run", "add", "i", "store", "config"]);
  const referenced = new Set<string>();
  for (const job of Object.values(workflow.jobs)) {
    for (const line of runLines(job)) {
      for (const m of line.matchAll(/\bpnpm\s+([a-z][\w:-]*)/g)) {
        if (!BUILT_IN.has(m[1]!)) referenced.add(m[1]!);
      }
    }
  }

  it("calls at least the expected scripts", () => {
    for (const s of [
      "lint",
      "format:check",
      "typecheck",
      "test:coverage",
      "build",
      "e2e",
      "e2e:ads",
      "check-links",
      "bundle-report",
    ]) {
      expect(referenced.has(s), s).toBe(true);
    }
  });

  it.each([...referenced])("pnpm %s is a script in package.json", (name) => {
    expect(pkg.scripts, name).toHaveProperty(name);
  });

  it("the scripts it calls point at files that exist", () => {
    for (const name of ["check-links", "bundle-report", "perf"]) {
      const file = /node (\S+)/.exec(pkg.scripts[name]!)?.[1];
      expect(file, name).toBeDefined();
      expect(() => readFileSync(join(root, file!), "utf8"), file).not.toThrow();
    }
  });
});

describe("job contents and order", () => {
  it("check: lint, format, types, unit tests with coverage, then the build", () => {
    const job = workflow.jobs.check!;
    const order = [
      "pnpm lint",
      "pnpm format:check",
      "pnpm typecheck",
      "pnpm test:coverage",
      "pnpm build",
    ].map((c) => indexOfRun(job, c));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("check: keeps the coverage report as an artifact", () => {
    const upload = workflow.jobs.check!.steps.find((s) =>
      s.uses?.startsWith("actions/upload-artifact@"),
    );
    expect(upload?.with?.path).toBe("coverage/");
    expect(upload?.if).toBe("always()");
  });

  it("e2e: installs the browser and builds before running anything against the site", () => {
    const job = workflow.jobs.e2e!;
    const browser = indexOfRun(job, "playwright install");
    const build = indexOfRun(job, "pnpm build");
    const links = indexOfRun(job, "pnpm check-links");
    const e2e = indexOfRun(job, "pnpm e2e");
    expect(browser).toBeGreaterThanOrEqual(0);
    expect(build).toBeGreaterThan(-1);
    expect(links).toBeGreaterThan(build);
    expect(e2e).toBeGreaterThan(links);
    expect(runLines(job).join("\n")).toMatch(/bundle-report .*--budget-js \d+/);
  });

  it("e2e: link check and budget failures fail the job but still stop the server", () => {
    const script = workflow.jobs.e2e!.steps.find((s) => s.run?.includes("check-links"))!.run!;
    expect(script).toMatch(/status=0/);
    expect(script).toMatch(/\|\| status=1/);
    expect(script).toMatch(/kill \$server/);
    expect(script).toMatch(/exit \$status/);
  });

  it("e2e: uploads the Playwright report only when something failed", () => {
    for (const name of ["e2e", "e2e-ads"]) {
      const upload = workflow.jobs[name]!.steps.find((s) =>
        s.uses?.startsWith("actions/upload-artifact@"),
      );
      expect(upload?.if, name).toBe("failure()");
      expect(String(upload?.with?.path)).toContain("playwright-report/");
    }
  });

  it("e2e-ads: runs the ads suite, which builds its own copy of the site", () => {
    expect(runLines(workflow.jobs["e2e-ads"]!)).toContain("pnpm e2e:ads");
  });

  it("builds with a production-looking site URL", () => {
    expect(workflow.env?.NEXT_PUBLIC_SITE_URL).toMatch(/^https:\/\//);
  });
});

describe("repository settings the workflow relies on", () => {
  it("the Node version file, engines field and the project agree", () => {
    const nvmrc = read(".nvmrc").trim();
    expect(nvmrc).toMatch(/^\d+$/);
    expect(pkg.engines?.node).toBe(`>=${nvmrc}`);
  });

  it("pnpm is pinned through packageManager so the action needs no version", () => {
    expect(pkg.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
  });

  it("the lockfile exists", () => {
    expect(() => readFileSync(join(root, "pnpm-lock.yaml"), "utf8")).not.toThrow();
  });

  it("line endings are normalized to LF so Prettier's check agrees on Windows and Linux", () => {
    expect(read(".gitattributes")).toMatch(/^\* text=auto eol=lf$/m);
  });

  it("both Playwright configs are stricter on CI: no .only, a retry, an HTML report", () => {
    for (const file of ["playwright.config.ts", "playwright.ads.config.ts"]) {
      const text = read(file);
      expect(text, file).toMatch(/forbidOnly: !!process\.env\.CI/);
      expect(text, file).toMatch(/retries: process\.env\.CI \? 1 : 0/);
      expect(text, file).toMatch(/\["html", \{ open: "never" \}\]/);
      expect(text, file).toMatch(/trace: "on-first-retry"/);
    }
  });

  it("the CI runner does not reuse a stale server: Playwright only reuses one outside CI", () => {
    expect(read("playwright.config.ts")).toMatch(/reuseExistingServer: !process\.env\.CI/);
  });

  it("the ads suite never reuses a server: it must test its own ads-enabled build", () => {
    expect(read("playwright.ads.config.ts")).toMatch(/reuseExistingServer: false/);
  });

  it("the single `check` script runs the same gates CI does", () => {
    expect(pkg.scripts.check).toBe(
      "pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build",
    );
  });

  it("generated output is ignored by git and Prettier", () => {
    const gitignore = read(".gitignore");
    for (const entry of ["/.next/", "/coverage", "/playwright-report/", "/test-results/"]) {
      expect(gitignore, entry).toContain(entry);
    }
    expect(read(".prettierignore")).toMatch(/coverage/);
  });
});
