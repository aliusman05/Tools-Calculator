/**
 * US federal income tax parameters for tax year 2026 (returns filed in 2027).
 *
 * THIS IS THE ONLY FILE THAT NEEDS UPDATING FOR A NEW TAX YEAR. Copy it to `tax-us-<year>.ts`,
 * change the numbers, and point `CURRENT_TAX_YEAR` in `src/lib/calculators/income-tax.ts` at it.
 *
 * Source: IRS Revenue Procedure 2025-32 (Internal Revenue Bulletin 2025-45, November 3, 2025):
 *   - Section 4.01  Tables 1-4, income tax rate schedules (brackets)
 *   - Section 4.14  basic standard deduction
 *   - Section 4.15  additional standard deduction for age 65+ or blind
 * https://www.irs.gov/irb/2025-45_IRB  and  https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
 *
 * VERIFICATION STATUS: values were read from the IRS bulletin on 2026-10-16 but have NOT been
 * checked line by line by the site owner. Check every number against the PDF above before launch,
 * then set `ownerVerified` to true. Brackets/deductions can also change by later legislation.
 */

export type FilingStatus = "single" | "mfj" | "hoh" | "mfs";

export type Bracket = {
  /** Taxable income above this amount is taxed at `rate` (until the next bracket starts). */
  over: number;
  /** Marginal rate in percent. */
  rate: number;
};

export type TaxYearData = {
  year: number;
  /** Where the numbers come from. */
  source: { name: string; url: string };
  /** Date the figures were last compared with the source (ISO). */
  lastChecked: string;
  /** Has the site owner confirmed every figure against the official source? */
  ownerVerified: boolean;
  standardDeduction: Record<FilingStatus, number>;
  /** Extra standard deduction per person who is 65+ or blind. */
  additionalDeduction: {
    /** Married filing jointly or separately (and surviving spouses). */
    married: number;
    /** Single or head of household. */
    unmarried: number;
  };
  brackets: Record<FilingStatus, readonly Bracket[]>;
};

export const taxUs2026: TaxYearData = {
  year: 2026,
  source: {
    name: "IRS Revenue Procedure 2025-32",
    url: "https://www.irs.gov/irb/2025-45_IRB",
  },
  lastChecked: "2026-10-16",
  ownerVerified: false,
  standardDeduction: {
    single: 16_100,
    mfj: 32_200,
    hoh: 24_150,
    mfs: 16_100,
  },
  additionalDeduction: {
    married: 1_650,
    unmarried: 2_050,
  },
  brackets: {
    single: [
      { over: 0, rate: 10 },
      { over: 12_400, rate: 12 },
      { over: 50_400, rate: 22 },
      { over: 105_700, rate: 24 },
      { over: 201_775, rate: 32 },
      { over: 256_225, rate: 35 },
      { over: 640_600, rate: 37 },
    ],
    mfj: [
      { over: 0, rate: 10 },
      { over: 24_800, rate: 12 },
      { over: 100_800, rate: 22 },
      { over: 211_400, rate: 24 },
      { over: 403_550, rate: 32 },
      { over: 512_450, rate: 35 },
      { over: 768_700, rate: 37 },
    ],
    hoh: [
      { over: 0, rate: 10 },
      { over: 17_700, rate: 12 },
      { over: 67_450, rate: 22 },
      { over: 105_700, rate: 24 },
      { over: 201_750, rate: 32 },
      { over: 256_200, rate: 35 },
      { over: 640_600, rate: 37 },
    ],
    mfs: [
      { over: 0, rate: 10 },
      { over: 12_400, rate: 12 },
      { over: 50_400, rate: 22 },
      { over: 105_700, rate: 24 },
      { over: 201_775, rate: 32 },
      { over: 256_225, rate: 35 },
      { over: 384_350, rate: 37 },
    ],
  },
};
