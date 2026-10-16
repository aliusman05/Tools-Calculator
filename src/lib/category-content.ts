import type { CategoryId } from "./registry";

export type CategoryContent = {
  /** Meta description, 150-160 characters. */
  metaDescription: string;
  /** Intro paragraphs shown at the top of the hub page. Written for this category only. */
  intro: string[];
  /** A short "how to choose" list. */
  guidance: { heading: string; points: string[] };
};

export const categoryContent: Record<CategoryId, CategoryContent> = {
  loans: {
    metaDescription:
      "Mortgage, loan and car loan calculators. Estimate monthly payments, total interest and payoff dates, and see how extra payments reduce what borrowing costs you.",
    intro: [
      "Borrowing money is usually the biggest financial commitment people make, and the details decide whether it is affordable. A small difference in rate or term can move the total cost by tens of thousands of dollars, even when the monthly payment looks almost the same.",
      "These calculators turn an amount, a rate and a term into a payment schedule you can read. You can see how much of each payment is interest, how a larger down payment changes the picture, and what happens to the payoff date when you pay a little extra each month.",
    ],
    guidance: {
      heading: "Choosing the right loan calculator",
      points: [
        "Use the mortgage calculator for a home purchase, because it adds property tax, insurance, HOA dues and PMI to the payment.",
        "Use the car loan calculator when a trade-in, sales tax or dealer fees change the amount you will finance.",
        "Use the general loan calculator for personal loans, student loans or any fixed-rate loan with equal monthly payments.",
        "Compare total interest, not just the monthly figure, before choosing a longer term.",
      ],
    },
  },
  savings: {
    metaDescription:
      "Savings calculators for compound interest, simple interest and savings goals. See how deposits grow over time and how much to save each month to reach a target.",
    intro: [
      "Saving works because of time and consistency. Interest earned in one year becomes part of the balance that earns interest the next year, so growth speeds up the longer money stays invested. Small, regular deposits made early often beat larger ones made late.",
      "The tools here show that effect in numbers. Compare compounding schedules, see the gap between simple and compound interest, or start from a goal, such as a house deposit or an emergency fund, and work backward to the monthly amount you need.",
    ],
    guidance: {
      heading: "Choosing the right savings calculator",
      points: [
        "Use the compound interest calculator to project a balance with regular deposits and different compounding schedules.",
        "Use the simple interest calculator for short-term loans and deposits, or to see how much compounding adds.",
        "Use the savings goal calculator when you have a target and a deadline and want a monthly figure.",
        "Remember that inflation reduces what a future balance can buy, so test a conservative rate.",
      ],
    },
  },
  investing: {
    metaDescription:
      "Investing and retirement calculators. Project a 401(k) with employer match, measure ROI and CAGR, and see what your savings could grow to in today's dollars.",
    intro: [
      "Investing is about turning today's savings into future purchasing power, and the outcome depends on three things you control: how much you put in, how long you stay invested, and what you pay in costs. Return is the one you control least, so it pays to plan around a range of results.",
      "These calculators help with both sides of the question. Project a retirement account with an employer match and yearly raises, then measure the performance of an investment you already hold using return on investment and compound annual growth rate.",
    ],
    guidance: {
      heading: "Choosing the right investing calculator",
      points: [
        "Use the retirement calculator to project a 401(k) or similar account and see the result in today's dollars.",
        "Use the ROI and CAGR calculator to compare investments held for different lengths of time.",
        "Test a lower return as well as an optimistic one, because real markets are uneven.",
        "Capture the full employer match first, as it is an immediate return on your contribution.",
      ],
    },
  },
  tax: {
    metaDescription:
      "Tax calculators for estimating US federal income tax. See your bracket breakdown, marginal and effective rates, and how deductions change what you owe.",
    intro: [
      "Income tax in the United States is progressive, which means different slices of your income are taxed at different rates. Many people overestimate what a raise or a bonus costs them because they confuse the top bracket they reach with the rate on all of their income.",
      "The estimator on this page walks through the brackets one by one and shows exactly where your tax comes from. It is meant for planning and learning, and it labels clearly what it leaves out, so you can treat the result as a starting point for a conversation with a tax professional.",
    ],
    guidance: {
      heading: "Using tax estimates wisely",
      points: [
        "Know the difference between your marginal rate, which applies to the next dollar, and your effective rate, which averages your whole bill.",
        "Compare the standard deduction with your itemized deductions and use the larger one.",
        "Pre-tax contributions to retirement and health accounts lower your taxable income.",
        "Check current-year figures on the IRS website before you rely on a number for a decision.",
      ],
    },
  },
  debt: {
    metaDescription:
      "Debt payoff calculators for credit cards and multiple balances. Find your debt-free date, compare snowball and avalanche, and see the interest you can save.",
    intro: [
      "High-interest debt works against you every month, and minimum payments are designed to keep a balance alive for years. The quickest way to see the real cost is to put the numbers in front of you: how many months remain, how much goes to interest, and what each extra dollar changes.",
      "Use these calculators to build a payoff plan you can follow. Work out how long a single credit card will take, or compare the snowball and avalanche strategies across all your debts to choose the order that fits your finances and your motivation.",
    ],
    guidance: {
      heading: "Choosing the right debt calculator",
      points: [
        "Use the credit card payoff calculator to see the time and interest at a fixed payment, or to find the payment needed for a deadline.",
        "Use the debt payoff planner when you have several balances and want to compare payoff orders.",
        "Always pay at least the minimum on every account while you focus extra money on one.",
        "Avoid adding new charges while you pay down a balance.",
      ],
    },
  },
  other: {
    metaDescription:
      "Everyday money calculators, starting with an inflation calculator that shows future prices, the value of money in today's dollars, and average inflation rates.",
    intro: [
      "Some money questions do not fit neatly into loans, savings or investing, but they affect almost every financial plan. Inflation is the clearest example: it quietly changes what a sum of money can buy, and it makes long-term targets look different once you adjust for it.",
      "This section collects those supporting tools. We are adding more over time, such as unit and currency helpers and percentage tools, and each one follows the same approach as the rest of the site: clear assumptions, open formulas, and calculations that run entirely in your browser.",
    ],
    guidance: {
      heading: "Putting these tools to use",
      points: [
        "Use the inflation calculator to adjust a long-term savings or retirement target for rising prices.",
        "Express future amounts in today's dollars so that they are easier to judge.",
        "Test more than one inflation rate to see how sensitive a plan is.",
      ],
    },
  },
};
