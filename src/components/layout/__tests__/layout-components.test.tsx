// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidNotice } from "@/components/calculators/shared/InvalidNotice";
import { PaymentStartFields } from "@/components/calculators/shared/PaymentStartFields";
import { ResultCard } from "@/components/calculators/shared/ResultCard";
import { ResultDisclaimer } from "@/components/calculators/shared/ResultDisclaimer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { SearchBox } from "@/components/layout/SearchBox";
import { SearchResults } from "@/components/layout/SearchResults";
import { FAQ } from "@/components/seo/FAQ";
import { RelatedTools } from "@/components/seo/RelatedTools";
import { getSummaries } from "@/lib/registry";

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

beforeEach(() => {
  push.mockClear();
  searchParams = new URLSearchParams();
});
afterEach(cleanup);

describe("Breadcrumbs", () => {
  it("links every crumb except the last, which is the current page", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Loans", href: "/category/loans" },
          { label: "Loan" },
        ]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Loans" })).toHaveAttribute("href", "/category/loans");
    expect(screen.queryByRole("link", { name: "Loan" })).toBeNull();
    expect(screen.getByText("Loan")).toHaveAttribute("aria-current", "page");
  });

  it("does not link the last crumb even if it has an href", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Here", href: "/here" },
        ]}
      />,
    );
    expect(screen.queryByRole("link", { name: "Here" })).toBeNull();
  });
});

describe("ResultCard", () => {
  it("shows the headline result in a polite live region with secondary results", () => {
    render(
      <ResultCard
        label="Monthly payment"
        value="$1,234.56"
        note="Principal and interest"
        secondary={[
          { label: "Total interest", value: "$50,000.00", note: "Over the life of the loan" },
          { label: "Payoff date", value: "Oct 2056" },
        ]}
      >
        <p>Extra child</p>
      </ResultCard>,
    );
    const live = screen.getByText("$1,234.56").closest("[aria-live]")!;
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveAttribute("aria-atomic", "true");
    expect(within(live as HTMLElement).getByText("Principal and interest")).toBeInTheDocument();
    expect(screen.getByText("Total interest").tagName).toBe("DT");
    expect(screen.getByText("$50,000.00").tagName).toBe("DD");
    expect(screen.getByText("Over the life of the loan")).toBeInTheDocument();
    expect(screen.getByText("Extra child")).toBeInTheDocument();
  });

  it("omits the list when there are no secondary results", () => {
    const { container } = render(<ResultCard label="X" value="1" />);
    expect(container.querySelector("dl")).toBeNull();
  });
});

describe("InvalidNotice / ResultDisclaimer", () => {
  it("announces invalid input as an alert, with a default or custom message", () => {
    const { rerender } = render(<InvalidNotice />);
    expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted fields");
    rerender(<InvalidNotice>Custom message</InvalidNotice>);
    expect(screen.getByRole("alert")).toHaveTextContent("Custom message");
  });

  it("the disclaimer says it is not advice and links to the full text", () => {
    render(<ResultDisclaimer />);
    expect(screen.getByTestId("result-disclaimer")).toHaveTextContent(
      "Not financial, tax or legal advice",
    );
    expect(screen.getByRole("link", { name: "Read the full disclaimer" })).toHaveAttribute(
      "href",
      "/disclaimer",
    );
  });
});

describe("PaymentStartFields", () => {
  it("reports month and year changes", () => {
    const onMonth = vi.fn();
    const onYear = vi.fn();
    render(
      <PaymentStartFields
        idPrefix="t"
        month={3}
        year={2026}
        onMonthChange={onMonth}
        onYearChange={onYear}
      />,
    );
    const month = screen.getByLabelText("First payment month") as HTMLSelectElement;
    expect(month.value).toBe("3");
    fireEvent.change(month, { target: { value: "11" } });
    expect(onMonth).toHaveBeenCalledWith(11);
    fireEvent.change(screen.getByLabelText("First payment year"), { target: { value: "2031" } });
    expect(onYear).toHaveBeenCalledWith(2031);
  });
});

describe("SearchBox", () => {
  const items = getSummaries();
  const type = (value: string) =>
    fireEvent.change(screen.getByLabelText("Search calculators"), { target: { value } });

  it("is a labelled search landmark", () => {
    render(<SearchBox items={items} landmarkLabel="Site search" />);
    expect(screen.getByRole("search", { name: "Site search" })).toBeInTheDocument();
  });

  it("shows no results until the visitor types", () => {
    render(<SearchBox items={items} landmarkLabel="Site search" />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("lists matches as links and announces how many were found", () => {
    render(<SearchBox items={items} landmarkLabel="Site search" />);
    type("loan");
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(1);
    expect(screen.getByRole("link", { name: "Loan Calculator" })).toHaveAttribute(
      "href",
      "/loan-calculator",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/\d+ calculators? found/);
  });

  it("caps the dropdown at six results", () => {
    render(<SearchBox items={items} landmarkLabel="Site search" />);
    type("calculator");
    expect(screen.getAllByRole("link").length).toBeLessThanOrEqual(6);
  });

  it("says when nothing matches", () => {
    render(<SearchBox items={items} landmarkLabel="Site search" />);
    type("zzzzqq");
    expect(screen.getByText(/No calculators match/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 calculators found");
  });

  it("Enter opens the only match directly", () => {
    render(<SearchBox items={items} landmarkLabel="Site search" />);
    type("avalanche");
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/debt-payoff-planner");
    expect(screen.getByLabelText("Search calculators")).toHaveValue("");
  });

  it("Enter opens the full results page when several match", () => {
    render(<SearchBox items={items} landmarkLabel="Site search" />);
    type("loan");
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/search?q=loan");
  });

  it("encodes the query and does nothing for a blank one", () => {
    render(<SearchBox items={items} landmarkLabel="Site search" />);
    type("a&b c");
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/search?q=a%26b%20c");
    push.mockClear();
    type("   ");
    fireEvent.submit(screen.getByRole("search"));
    expect(push).not.toHaveBeenCalled();
  });

  it("clears the box when a result is clicked", () => {
    render(<SearchBox items={items} landmarkLabel="Site search" />);
    type("mortgage");
    fireEvent.click(screen.getByRole("link", { name: "Mortgage Calculator" }));
    expect(screen.getByLabelText("Search calculators")).toHaveValue("");
  });
});

describe("SearchResults", () => {
  const items = getSummaries();

  it("prompts when there is no query", () => {
    render(<SearchResults items={items} />);
    expect(screen.getByText(/Type in the search box/)).toBeInTheDocument();
  });

  it("lists matches with a count for the query", () => {
    searchParams = new URLSearchParams("q=credit card");
    render(<SearchResults items={items} />);
    expect(screen.getByText(/1 result for/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Credit Card Payoff Calculator/ })).toHaveAttribute(
      "href",
      "/credit-card-payoff-calculator",
    );
  });

  it("pluralises and offers a way out when nothing matches", () => {
    searchParams = new URLSearchParams("q=loan");
    const { unmount } = render(<SearchResults items={items} />);
    expect(screen.getByText(/\d+ results for/)).toBeInTheDocument();
    unmount();

    searchParams = new URLSearchParams("q=zzzzqq");
    render(<SearchResults items={items} />);
    expect(screen.getByText(/Nothing matched/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "browse all calculators" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("FAQ and RelatedTools", () => {
  it("FAQ renders every question as a disclosure", () => {
    const { container } = render(
      <FAQ
        faqs={[
          { question: "Q one?", answer: "A one." },
          { question: "Q two?", answer: "A two." },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Frequently asked questions" })).toBeInTheDocument();
    expect(container.querySelectorAll("details")).toHaveLength(2);
  });

  it("RelatedTools links to existing calculators and skips unknown ones", () => {
    render(<RelatedTools slugs={["loan-calculator", "does-not-exist", "roi-calculator"]} />);
    expect(screen.getByRole("heading", { name: "Related calculators" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Loan Calculator/ })).toHaveAttribute(
      "href",
      "/loan-calculator",
    );
  });

  it("RelatedTools renders nothing when nothing resolves", () => {
    const { container } = render(<RelatedTools slugs={["nope"]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
