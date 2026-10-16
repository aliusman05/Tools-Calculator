/**
 * 401(k) / retirement projection. Contributions are made monthly (at month end) as a percentage
 * of salary; salary rises once a year. Returns compound monthly using the equivalent of the
 * stated annual return. Inflation is only used to express results in today's dollars.
 */

export type RetirementInput = {
  currentAge: number;
  retirementAge: number;
  currentBalance: number;
  /** Current annual salary. */
  salary: number;
  /** Employee contribution as a percent of salary. */
  contributionPct: number;
  /** Employer matches this percent of the employee's contribution (50 = 50 cents per dollar). */
  matchPct: number;
  /** ...up to this percent of salary. */
  matchLimitPct: number;
  /** Expected annual investment return in percent. */
  returnPct: number;
  salaryGrowthPct: number;
  inflationPct: number;
  /** Withdrawal rate for the retirement income illustration (4 = the "4% rule"). */
  withdrawalPct: number;
};

export type RetirementField = keyof RetirementInput;
export type RetirementErrors = Partial<Record<RetirementField, string>>;

export type RetirementYearRow = {
  /** Age at the end of the year. */
  age: number;
  salary: number;
  employee: number;
  employer: number;
  growth: number;
  balance: number;
  /** Balance in today's dollars. */
  realBalance: number;
};

export type RetirementResult = {
  years: number;
  balanceAtRetirement: number;
  /** Balance at retirement in today's dollars. */
  realBalance: number;
  employeeContributions: number;
  employerContributions: number;
  growth: number;
  /** First-year withdrawal under the chosen rate (nominal dollars at retirement). */
  annualIncome: number;
  annualIncomeReal: number;
  monthlyIncomeReal: number;
  /** Employer money left on the table if the match limit is not reached. */
  matchCaptured: boolean;
  schedule: RetirementYearRow[];
};

export type RetirementOutcome =
  { ok: true; result: RetirementResult } | { ok: false; errors: RetirementErrors };

export function validateRetirement(input: RetirementInput): RetirementErrors {
  const errors: RetirementErrors = {};
  const ok = Number.isFinite;
  const range = (field: RetirementField, min: number, max: number, message: string) => {
    const v = input[field];
    if (!ok(v) || v < min || v > max) errors[field] = message;
  };

  if (!Number.isInteger(input.currentAge) || input.currentAge < 16 || input.currentAge > 99) {
    errors.currentAge = "Enter a whole-number age between 16 and 99.";
  }
  if (
    !Number.isInteger(input.retirementAge) ||
    input.retirementAge > 100 ||
    input.retirementAge <= input.currentAge
  ) {
    errors.retirementAge =
      "Retirement age must be a whole number above your current age (up to 100).";
  }
  range("currentBalance", 0, Number.MAX_SAFE_INTEGER, "Balance cannot be negative.");
  range("salary", 0, Number.MAX_SAFE_INTEGER, "Salary cannot be negative.");
  range("contributionPct", 0, 100, "Enter a percent between 0 and 100.");
  range("matchPct", 0, 200, "Enter a percent between 0 and 200.");
  range("matchLimitPct", 0, 100, "Enter a percent between 0 and 100.");
  range("returnPct", -50, 50, "Enter a return between -50% and 50%.");
  range("salaryGrowthPct", -20, 50, "Enter a percent between -20% and 50%.");
  range("inflationPct", -10, 50, "Enter a percent between -10% and 50%.");
  range("withdrawalPct", 0, 50, "Enter a percent between 0 and 50.");
  return errors;
}

export function calculateRetirement(input: RetirementInput): RetirementOutcome {
  const errors = validateRetirement(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const years = input.retirementAge - input.currentAge;
  const months = years * 12;
  const monthlyReturn = Math.pow(1 + input.returnPct / 100, 1 / 12) - 1;
  const employeeRate = input.contributionPct / 100;
  const employerRate =
    (Math.min(input.contributionPct, input.matchLimitPct) / 100) * (input.matchPct / 100);

  let balance = input.currentBalance;
  let employeeTotal = 0;
  let employerTotal = 0;
  let growthTotal = 0;
  const schedule: RetirementYearRow[] = [];
  let yEmployee = 0;
  let yEmployer = 0;
  let yGrowth = 0;

  for (let month = 1; month <= months; month++) {
    const yearIndex = Math.floor((month - 1) / 12);
    const salary = input.salary * Math.pow(1 + input.salaryGrowthPct / 100, yearIndex);
    const employee = (salary / 12) * employeeRate;
    const employer = (salary / 12) * employerRate;
    const growth = balance * monthlyReturn;

    balance += growth + employee + employer;
    employeeTotal += employee;
    employerTotal += employer;
    growthTotal += growth;
    yEmployee += employee;
    yEmployer += employer;
    yGrowth += growth;

    if (month % 12 === 0) {
      schedule.push({
        age: input.currentAge + month / 12,
        salary,
        employee: yEmployee,
        employer: yEmployer,
        growth: yGrowth,
        balance,
        realBalance: balance / Math.pow(1 + input.inflationPct / 100, month / 12),
      });
      yEmployee = 0;
      yEmployer = 0;
      yGrowth = 0;
    }
  }

  const realFactor = Math.pow(1 + input.inflationPct / 100, years);
  const annualIncome = (balance * input.withdrawalPct) / 100;

  return {
    ok: true,
    result: {
      years,
      balanceAtRetirement: balance,
      realBalance: balance / realFactor,
      employeeContributions: employeeTotal,
      employerContributions: employerTotal,
      growth: growthTotal,
      annualIncome,
      annualIncomeReal: annualIncome / realFactor,
      monthlyIncomeReal: annualIncome / realFactor / 12,
      matchCaptured: input.contributionPct >= input.matchLimitPct || input.matchPct === 0,
      schedule,
    },
  };
}
