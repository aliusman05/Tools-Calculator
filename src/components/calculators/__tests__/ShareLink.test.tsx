// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareLink } from "@/components/calculators/shared/ShareLink";
import { registerShareSource } from "@/lib/share-store";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ShareLink", () => {
  it("copies the link and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const off = registerShareSource(() => "https://x.test/calc?rate=7");
    render(<ShareLink />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Link copied"));
    expect(writeText).toHaveBeenCalledWith("https://x.test/calc?rate=7");
    off();
  });

  it("falls back to a selectable field when the clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const off = registerShareSource(() => "https://x.test/calc?rate=7");
    render(<ShareLink />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    const field = await screen.findByLabelText("Link with your inputs");
    expect(field).toHaveValue("https://x.test/calc?rate=7");
    expect(field).toHaveAttribute("readonly");
    expect(screen.getByRole("status")).toHaveTextContent("Copy this link yourself");
    off();
  });
});
