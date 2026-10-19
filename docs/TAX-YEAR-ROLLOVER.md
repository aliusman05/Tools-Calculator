# Tax year rollover

The income tax estimator and the take-home pay calculator use **2026** figures. Each autumn the IRS and
the Social Security Administration publish the next year's numbers. This page says what to do, and what
has and has not been published. **Never enter guessed numbers**: wait for the official source.

## Status on 2026-10-19

| Figure for 2027                                       | Published?                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Income tax brackets and standard deductions           | **Not found yet.** Check IRS newsroom and the Internal Revenue Bulletin (last year's was Rev. Proc. 2025-32, Oct 2025). |
| 401(k) deferral and catch-up limits                   | **Not found yet.** Last year's came from IRS Notice 2025-67, announced in November.                                     |
| Social Security wage base                             | SSA has published a 2027 base (about $192,300 according to search results). **Read it on ssa.gov before using it.**     |
| Medicare and Additional Medicare rates and thresholds | Unchanged by inflation (0.9% above $200,000 / $250,000 / $125,000); confirm on IRS Topic 560 each year.                 |

Check weekly until the first two are published.

## Steps when the sources exist

1. **Income tax data.** Copy `src/lib/data/tax-us-2026.ts` to `tax-us-2027.ts`. Change the year, the source
   and `lastChecked`, the standard deductions, the age/blind additions and all four bracket tables. Set
   `ownerVerified: false`.
2. **Payroll data.** Copy `src/lib/data/payroll-us-2026.ts` to `payroll-us-2027.ts`. Change the wage base,
   the 401(k) limits, the sources and `lastChecked`. Set `ownerVerified: false`.
3. **Tests.** Copy the IRS "tax at the start of each bracket" amounts from the new revenue procedure into
   `income-tax.test.ts` (as was done for 2026) and re-derive the take-home pay reference values with the
   independent arithmetic described at the top of `take-home-pay.test.ts`.
4. **Choosing the year.** From 1 January people ask about the new year's paychecks, but they still file
   the old year's return until April. Add a year selector (2026 / 2027) to the income tax and take-home pay
   calculators, default to the newer year once it is January, and keep the older year available. The
   engines already take the year's data as a parameter (`calculateIncomeTax(input, data)` and
   `calculateTakeHome(input, data)`), so the selector only has to pass the right file. The page already
   states the tax year in the result.
5. **Pages.** Update the "Figures used for 20XX" section of the take-home pay page and the worked examples;
   `content-examples.test.ts` fails if the text and the engines disagree.
6. **Sign-off.** The launch check reminds you to set each `ownerVerified` flag after you compare the figures
   with the official pages yourself.

## Sources

- IRS inflation adjustments: Revenue Procedure for the year, in the Internal Revenue Bulletin
  (<https://www.irs.gov/irb>).
- Retirement plan limits: IRS Notice (announced in the autumn),
  <https://www.irs.gov/retirement-plans/cola-increases-for-dollar-limitations-on-benefits-and-contributions>.
- Social Security wage base: <https://www.ssa.gov/oact/cola/cbb.html>.
- Medicare and Additional Medicare: <https://www.irs.gov/taxtopics/tc751> and
  <https://www.irs.gov/taxtopics/tc560>.
