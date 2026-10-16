// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AffiliateDisclosure } from "@/components/legal/AffiliateDisclosure";

afterEach(cleanup);

describe("AffiliateDisclosure", () => {
  it("says that commissions may be earned at no extra cost", () => {
    render(<AffiliateDisclosure />);
    const note = screen.getByTestId("affiliate-disclosure");
    expect(note).toHaveTextContent("Advertising disclosure");
    expect(note).toHaveTextContent("may earn a commission");
    expect(note).toHaveTextContent("at no extra cost to you");
  });

  it("links to the affiliate section of the disclaimer", () => {
    render(<AffiliateDisclosure />);
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "/disclaimer#affiliate",
    );
  });

  it("has a shorter compact form for use next to a single link", () => {
    const { rerender } = render(<AffiliateDisclosure />);
    const full = screen.getByTestId("affiliate-disclosure").textContent ?? "";
    rerender(<AffiliateDisclosure compact />);
    const compact = screen.getByTestId("affiliate-disclosure").textContent ?? "";
    expect(compact.length).toBeLessThan(full.length);
    expect(compact).toContain("commission");
  });
});
