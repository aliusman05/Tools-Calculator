"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th } from "@/components/ui/Table";
import { aggregateByYear, type ScheduleRow } from "@/lib/calculators/amortization";
import { paymentDate } from "@/lib/calculators/mortgage";
import { formatCurrency, formatMonthYear } from "@/lib/format";

const PAGE_SIZE = 120;
const PAGINATE_ABOVE = 360;

type View = "monthly" | "yearly";

const money = (v: number) => formatCurrency(v);

export function AmortizationTable({
  schedule,
  firstMonth,
  firstYear,
}: {
  schedule: readonly ScheduleRow[];
  /** Calendar month (1-12) and year of the first payment, used for date labels. */
  firstMonth: number;
  firstYear: number;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("yearly");
  const [page, setPage] = useState(0);
  const yearly = useMemo(() => aggregateByYear(schedule), [schedule]);

  const paginated = view === "monthly" && schedule.length > PAGINATE_ABOVE;
  const pageCount = paginated ? Math.ceil(schedule.length / PAGE_SIZE) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const monthlyRows = paginated
    ? schedule.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
    : schedule;

  return (
    <section className="rounded-card border-border bg-surface border p-4">
      <h3 className="sr-only">Amortization schedule</h3>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="amortization-panel"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left font-semibold"
      >
        Amortization schedule
        <span aria-hidden="true" className="text-muted text-sm">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div id="amortization-panel" className="mt-3 flex flex-col gap-3">
          <div role="group" aria-label="Schedule view" className="flex gap-2">
            {(["yearly", "monthly"] as const).map((v) => (
              <Button
                key={v}
                variant={view === v ? "primary" : "secondary"}
                aria-pressed={view === v}
                onClick={() => {
                  setView(v);
                  setPage(0);
                }}
              >
                {v === "yearly" ? "Yearly" : "Monthly"}
              </Button>
            ))}
          </div>

          {view === "yearly" ? (
            <Table caption="Yearly amortization schedule">
              <thead>
                <tr>
                  <Th>Year</Th>
                  <Th align="right">Principal</Th>
                  <Th align="right">Interest</Th>
                  <Th align="right">Extra</Th>
                  <Th align="right">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {yearly.map((y) => (
                  <tr key={y.year}>
                    <Td>{y.year}</Td>
                    <Td align="right">{money(y.principal)}</Td>
                    <Td align="right">{money(y.interest)}</Td>
                    <Td align="right">{money(y.extra)}</Td>
                    <Td align="right">{money(y.balance)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <>
              <Table caption="Monthly amortization schedule">
                <thead>
                  <tr>
                    <Th>Payment</Th>
                    <Th>Date</Th>
                    <Th align="right">Principal</Th>
                    <Th align="right">Interest</Th>
                    <Th align="right">Extra</Th>
                    <Th align="right">Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((row) => {
                    const d = paymentDate(firstMonth, firstYear, row.month);
                    return (
                      <tr key={row.month}>
                        <Td>{row.month}</Td>
                        <Td>{formatMonthYear(d.month, d.year, true)}</Td>
                        <Td align="right">{money(row.principal)}</Td>
                        <Td align="right">{money(row.interest)}</Td>
                        <Td align="right">{money(row.extra)}</Td>
                        <Td align="right">{money(row.balance)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              {paginated && (
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="secondary"
                    disabled={safePage === 0}
                    onClick={() => setPage(safePage - 1)}
                  >
                    Previous
                  </Button>
                  <p className="text-muted text-sm" aria-live="polite">
                    Payments {safePage * PAGE_SIZE + 1}–
                    {Math.min((safePage + 1) * PAGE_SIZE, schedule.length)} of {schedule.length}
                  </p>
                  <Button
                    variant="secondary"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage(safePage + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
