// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { SliderField } from "@/components/ui/SliderField";

afterEach(cleanup);

function CurrencyHarness({ initial = null }: { initial?: number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <CurrencyInput id="price" label="Home price" value={value} onChange={setValue} />
      <output data-testid="value">{value === null ? "empty" : value}</output>
    </>
  );
}

describe("CurrencyInput", () => {
  it("is labelled and formats with thousands separators", () => {
    render(<CurrencyHarness />);
    const input = screen.getByLabelText("Home price");
    fireEvent.change(input, { target: { value: "1234567" } });
    expect((input as HTMLInputElement).value).toBe("1,234,567");
    expect(screen.getByTestId("value").textContent).toBe("1234567");
  });

  it("drops non-numeric characters", () => {
    render(<CurrencyHarness />);
    const input = screen.getByLabelText("Home price") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12ab-3" } });
    expect(input.value).toBe("123");
  });

  it("reports null when cleared", () => {
    render(<CurrencyHarness initial={500} />);
    const input = screen.getByLabelText("Home price");
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByTestId("value").textContent).toBe("empty");
  });
});

describe("PercentInput", () => {
  it("does not insert separators", () => {
    function Harness() {
      const [v, setV] = useState<number | null>(null);
      return <PercentInput id="rate" label="Rate" value={v} onChange={setV} />;
    }
    render(<Harness />);
    const input = screen.getByLabelText("Rate") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "6.875" } });
    expect(input.value).toBe("6.875");
  });
});

describe("SliderField", () => {
  it("keeps the text input and slider in sync", () => {
    function Harness() {
      const [v, setV] = useState<number | null>(20);
      return <SliderField id="term" label="Term" value={v} onChange={setV} min={1} max={40} />;
    }
    render(<Harness />);
    const slider = screen.getByLabelText("Term slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "30" } });
    expect((screen.getByLabelText("Term") as HTMLInputElement).value).toBe("30");
  });
});
