import { calculators } from "../../src/lib/registry";

/**
 * Every calculator slug, read from the registry so a new calculator is covered by the shared tests
 * (smoke, accessibility-adjacent, ads, share links) without editing each spec. Per-calculator
 * expectations (a default answer, a label) live in the specs that need them and are added alongside
 * the calculator; a missing entry makes that test fail rather than silently skip.
 */
export const CALCULATOR_SLUGS: string[] = calculators.map((c) => c.slug);
