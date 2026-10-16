import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculators } from "@/lib/registry";

const root = process.cwd();

describe("public/ads.txt", () => {
  const text = readFileSync(join(root, "public", "ads.txt"), "utf8");
  const records = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  it("has at least one record", () => {
    expect(records.length).toBeGreaterThan(0);
  });

  it.each(records)("record %j follows the IAB format", (line) => {
    const [domain, id, relationship, certId] = line.split(",").map((p) => p.trim());
    expect(domain).toBe("google.com");
    expect(id).toMatch(/^pub-\d{16}$/);
    expect(relationship).toBe("DIRECT");
    expect(certId).toBe("f08c47fec0942fa0"); // Google's fixed certification authority ID
  });

  it("is still the placeholder (so the launch checklist must replace it)", () => {
    // If this fails because you put in your real ID, delete this test and the checklist item.
    expect(text).toContain("pub-0000000000000000");
    expect(text).toMatch(/PLACEHOLDER/);
  });
});

describe("calculator content ad placement", () => {
  const dir = join(root, "src", "content", "calculators");
  const files = readdirSync(dir).filter((f) => f.endsWith(".mdx"));

  it("covers every calculator", () => {
    expect(files.length).toBe(calculators.length);
  });

  it.each(files)(
    "%s has exactly one in-content ad, after 'How it works' and before the worked example",
    (file) => {
      const s = readFileSync(join(dir, file), "utf8");
      expect(s.match(/<ContentAd \/>/g)?.length).toBe(1);
      const how = s.indexOf("## How it works");
      const ad = s.indexOf("<ContentAd />");
      const worked = s.indexOf("## Worked example");
      expect(how).toBeGreaterThan(-1);
      expect(ad).toBeGreaterThan(how);
      expect(worked).toBeGreaterThan(ad);
    },
  );

  it.each(files)("%s never puts an ad directly beside the calculator", (file) => {
    const s = readFileSync(join(dir, file), "utf8");
    const calc = s.indexOf("<Calculator />");
    const ad = s.indexOf("<ContentAd />");
    // At least the whole "How to use" and "How it works" sections lie between them.
    expect(ad - calc).toBeGreaterThan(500);
  });
});
