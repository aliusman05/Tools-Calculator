/**
 * US payroll tax and retirement-plan parameters for 2026, used by the take-home pay calculator.
 * Federal income tax brackets and standard deductions live in `tax-us-2026.ts`.
 *
 * THIS FILE NEEDS UPDATING EVERY YEAR. Copy it to `payroll-us-<year>.ts`, change the numbers, and point
 * `CURRENT_PAYROLL_YEAR` in `src/lib/calculators/take-home-pay.ts` at it. Note that the Social Security
 * Administration has already published the 2027 wage base, so the 2027 file can be made as soon as the
 * IRS publishes the 2027 income tax adjustments.
 *
 * Sources (each figure was compared with the official pages on 2026-10-19; see the verification note
 * below for exactly what was read directly):
 *   - Social Security wage base $184,500 and the 6.2% / 1.45% employee rates:
 *       SSA, Contribution and Benefit Base (https://www.ssa.gov/oact/cola/cbb.html) and
 *       IRS Topic no. 751, Social Security and Medicare withholding rates
 *       (https://www.irs.gov/taxtopics/tc751, last reviewed 24 Sep 2026: "For earnings in 2026, this
 *       base limit is $184,500").
 *   - Additional Medicare Tax 0.9%, with thresholds $250,000 (married filing jointly), $125,000 (married
 *       filing separately) and $200,000 (all others); employers begin withholding it on wages above
 *       $200,000 regardless of filing status:
 *       IRS Topic no. 560 (https://www.irs.gov/taxtopics/tc560, last reviewed 9 Oct 2026).
 *   - 401(k) employee deferral limit $24,500; age 50+ catch-up $8,000; ages 60 to 63 catch-up $11,250:
 *       IRS news release IR-2025-111, 13 Nov 2025
 *       (https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500),
 *       from IRS Notice 2025-67 (https://www.irs.gov/pub/irs-drop/n-25-67.pdf).
 *
 * VERIFICATION STATUS (2026-10-19): the IRS pages (Topic 751, Topic 560 and the 401(k) news release)
 * were fetched and read directly. The SSA "Contribution and Benefit Base" page could not be fetched at
 * the time, so the $184,500 wage base was confirmed from SSA's search-result summaries on ssa.gov (the
 * 2026 COLA fact sheet and the base table) and from IRS Topic 751, which states it in full. Nobody has
 * yet opened every source page and compared every number by eye, which is what `ownerVerified` is for:
 * it is YOUR sign-off, and the launch check reminds you about it. Open the pages listed above yourself
 * before setting it. Tax law can change after these pages were published, so re-check each autumn.
 */

export type PayrollYearData = {
  year: number;
  sources: ReadonlyArray<{ name: string; url: string }>;
  /** Date the figures were last compared with the sources (ISO). */
  lastChecked: string;
  /** Has the site owner confirmed every figure against the official sources? */
  ownerVerified: boolean;
  socialSecurity: {
    /** Employee share, in percent. */
    employeeRatePct: number;
    /** Wages above this amount are not subject to Social Security tax. */
    wageBase: number;
  };
  medicare: {
    /** Employee share, in percent. No wage cap. */
    employeeRatePct: number;
    additional: {
      ratePct: number;
      /** Wages above this are taxed at `ratePct`, by filing status (liability on the tax return). */
      threshold: { single: number; hoh: number; mfj: number; mfs: number };
      /** Employers start withholding above this amount, whatever the filing status. */
      employerWithholdingStart: number;
    };
  };
  retirement401k: {
    /** Employee elective deferral limit for a 401(k), 403(b), most 457(b) and the federal TSP. */
    deferralLimit: number;
    /** Extra allowed from age 50. */
    catchUp50: number;
    /** Extra allowed instead of the age 50 amount in the years the participant is 60, 61, 62 or 63. */
    catchUp60to63: number;
  };
};

export const payrollUs2026: PayrollYearData = {
  year: 2026,
  sources: [
    { name: "SSA, Contribution and Benefit Base", url: "https://www.ssa.gov/oact/cola/cbb.html" },
    {
      name: "IRS Topic no. 751, Social Security and Medicare withholding rates",
      url: "https://www.irs.gov/taxtopics/tc751",
    },
    {
      name: "IRS Topic no. 560, Additional Medicare Tax",
      url: "https://www.irs.gov/taxtopics/tc560",
    },
    {
      name: "IRS IR-2025-111 (Notice 2025-67), 2026 retirement plan limits",
      url: "https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500",
    },
  ],
  lastChecked: "2026-10-19",
  ownerVerified: false,
  socialSecurity: { employeeRatePct: 6.2, wageBase: 184_500 },
  medicare: {
    employeeRatePct: 1.45,
    additional: {
      ratePct: 0.9,
      threshold: { single: 200_000, hoh: 200_000, mfj: 250_000, mfs: 125_000 },
      employerWithholdingStart: 200_000,
    },
  },
  retirement401k: { deferralLimit: 24_500, catchUp50: 8_000, catchUp60to63: 11_250 },
};
