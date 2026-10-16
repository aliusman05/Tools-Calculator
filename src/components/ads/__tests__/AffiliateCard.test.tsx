// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AffiliateCard, AffiliateSlot } from "@/components/ads/AffiliateCard";
import type { AffiliateOffer } from "@/lib/data/affiliates";

afterEach(cleanup);

const offer: AffiliateOffer = {
  id: "demo",
  partner: "Demo Bank",
  headline: "A demo headline for the card",
  description: "A demo description that explains the offer in plain language.",
  cta: "See the offer",
  url: "https://partner.example/ref?id=42",
  contexts: ["credit-card"],
  active: true,
};

describe("AffiliateCard", () => {
  it('links out with rel="sponsored noopener" in a new tab', () => {
    render(<AffiliateCard offer={offer} />);
    const link = screen.getByRole("link", { name: /See the offer/ });
    expect(link).toHaveAttribute("href", "https://partner.example/ref?id=42");
    expect(link).toHaveAttribute("rel", "sponsored noopener");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("labels the card as sponsored and shows the disclosure next to the link", () => {
    render(<AffiliateCard offer={offer} />);
    expect(screen.getByText("Sponsored")).toBeInTheDocument();
    expect(screen.getByTestId("affiliate-disclosure")).toHaveTextContent("may earn a commission");
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "/disclaimer#affiliate",
    );
  });

  it("tells screen reader users that the link is sponsored and opens a new tab", () => {
    render(<AffiliateCard offer={offer} />);
    expect(
      screen.getByRole("link", { name: /opens in a new tab, sponsored link/ }),
    ).toBeInTheDocument();
  });

  it("names the partner and shows the copy", () => {
    render(<AffiliateCard offer={offer} />);
    expect(screen.getByText("A demo headline for the card")).toBeInTheDocument();
    expect(screen.getByText(/Offered by Demo Bank/)).toBeInTheDocument();
  });
});

describe("AffiliateSlot", () => {
  it("renders nothing when no offer is active for the context", () => {
    const { container } = render(<AffiliateSlot context="credit-card" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing without a context", () => {
    const { container } = render(<AffiliateSlot context={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
