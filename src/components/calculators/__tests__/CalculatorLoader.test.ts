import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculatorComponents } from "@/components/calculators/CalculatorLoader";
import { calculators } from "@/lib/registry";

describe("calculator loader", () => {
  it("has exactly one lazy component per registry entry", () => {
    expect(Object.keys(calculatorComponents).sort()).toEqual(calculators.map((c) => c.slug).sort());
  });

  const source = readFileSync(
    join(process.cwd(), "src", "components", "calculators", "CalculatorLoader.tsx"),
    "utf8",
  );
  const imports = [...source.matchAll(/import\("@\/components\/calculators\/([^"]+)"\)/g)].map(
    (m) => m[1]!,
  );

  it("writes every import out literally so the bundler can find it", () => {
    expect(imports).toHaveLength(calculators.length);
  });

  it.each(imports)("%s exists and is a client component with a default export", (path) => {
    const file = join(process.cwd(), "src", "components", "calculators", `${path}.tsx`);
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, "utf8");
    expect(text.startsWith('"use client"')).toBe(true);
    expect(text).toMatch(/export default function \w+/);
  });
});

describe("registry stays free of component imports", () => {
  it("does not import calculators, which would pull them into the root layout's bundle", () => {
    const registry = readFileSync(join(process.cwd(), "src", "lib", "registry.ts"), "utf8");
    expect(registry).not.toMatch(/components\/calculators/);
    expect(registry).not.toMatch(/import\(/);
  });
});
