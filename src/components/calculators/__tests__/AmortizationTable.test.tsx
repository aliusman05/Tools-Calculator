// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AmortizationTable } from "@/components/calculators/shared/AmortizationTable";
import { CalculatorShell } from "@/components/calculators/shared/CalculatorShell";
import { amortize } from "@/lib/calculators/amortization";

afterEach(cleanup);

const thirtyYear = amortize({ principal: 300_000, annualRatePct: 6, termMonths: 360 }).schedule;
const fortyYear = amortize({ principal: 300_000, annualRatePct: 6, termMonths: 480 }).schedule;

function open() {
  fireEvent.click(screen.getByRole("button", { name: /Amortization schedule/ }));
}

const bodyRows = (name: string) =>
  within(screen.getByRole("table", { name })).getAllByRole("row").slice(1);

describe("AmortizationTable", () => {
  it("is collapsed by default and exposes its state", () => {
    render(<AmortizationTable schedule={thirtyYear} firstMonth={11} firstYear={2026} />);
    const toggle = screen.getByRole("button", { name: /Amortization schedule/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table")).toBeNull();
    open();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("table", { name: "Yearly amortization schedule" })).toBeInTheDocument();
  });

  it("opens on the yearly view: one row per year, ending at a zero balance", () => {
    render(<AmortizationTable schedule={thirtyYear} firstMonth={11} firstYear={2026} />);
    open();
    const rows = bodyRows("Yearly amortization schedule");
    expect(rows).toHaveLength(30);
    const lastCells = within(rows[29]!).getAllByRole("cell");
    expect(lastCells[lastCells.length - 1]).toHaveTextContent("$0.00");
  });

  it("switches to the monthly view with real dates, and back", { timeout: 30_000 }, () => {
    render(<AmortizationTable schedule={thirtyYear} firstMonth={11} firstYear={2026} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    const rows = bodyRows("Monthly amortization schedule");
    expect(rows).toHaveLength(360); // 30 years is not paginated
    expect(within(rows[0]!).getByText("Nov 2026")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Jan 2027")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(screen.getByRole("table", { name: "Yearly amortization schedule" })).toBeInTheDocument();
  });

  it("paginates a schedule over 360 payments, 120 at a time", { timeout: 30_000 }, () => {
    render(<AmortizationTable schedule={fortyYear} firstMonth={1} firstYear={2026} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(bodyRows("Monthly amortization schedule")).toHaveLength(120);
    expect(screen.getByText(/Payments 1–120 of 480/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Payments 121–240 of 480/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Payments 361–480 of 480/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    const rows = bodyRows("Monthly amortization schedule");
    const cells = within(rows[rows.length - 1]!).getAllByRole("cell");
    expect(cells[cells.length - 1]).toHaveTextContent("$0.00");

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText(/Payments 241–360 of 480/)).toBeInTheDocument();
  });

  it("returns to the first page when the view changes", { timeout: 30_000 }, () => {
    render(<AmortizationTable schedule={fortyYear} firstMonth={1} firstYear={2026} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByText(/Payments 1–120 of 480/)).toBeInTheDocument();
  });

  it("collapses again", () => {
    render(<AmortizationTable schedule={thirtyYear} firstMonth={1} firstYear={2026} />);
    open();
    open();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("CalculatorShell", () => {
  it("renders inputs and results in labelled regions, with the disclaimer under the results", () => {
    render(
      <CalculatorShell
        title="Loan calculator"
        inputs={<p>The inputs</p>}
        results={<p>The results</p>}
      />,
    );
    const inputs = screen.getByRole("region", { name: "Loan calculator inputs" });
    const results = screen.getByRole("region", { name: "Loan calculator results" });
    expect(within(inputs).getByText("The inputs")).toBeInTheDocument();
    expect(within(results).getByText("The results")).toBeInTheDocument();
    expect(within(results).getByTestId("result-disclaimer")).toBeInTheDocument();
  });

  it("renders no ad boxes when ads are off, but honours explicit slots", () => {
    const { container, rerender } = render(
      <CalculatorShell title="T" inputs={<p>i</p>} results={<p>r</p>} />,
    );
    expect(container.querySelector("[data-ad-placement], [data-ad-placeholder]")).toBeNull();
    rerender(
      <CalculatorShell
        title="T"
        inputs={<p>i</p>}
        results={<p>r</p>}
        afterInputs={<p>after inputs</p>}
        sidebar={<p>sidebar</p>}
        below={<p>below</p>}
      />,
    );
    expect(screen.getByText("after inputs")).toBeInTheDocument();
    expect(screen.getByText("sidebar")).toBeInTheDocument();
    expect(screen.getByText("below")).toBeInTheDocument();
  });
});
