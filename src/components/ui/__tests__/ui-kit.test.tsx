// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Accordion } from "@/components/ui/Accordion";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { describedBy, Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, Td, Th } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";

afterEach(cleanup);

describe("Field / describedBy", () => {
  it("points aria-describedby at the error before the hint", () => {
    expect(describedBy("x", "hint", "error")).toBe("x-error");
    expect(describedBy("x", "hint")).toBe("x-hint");
    expect(describedBy("x")).toBeUndefined();
  });

  it("shows the hint, or the error instead of it, and announces errors", () => {
    const { rerender } = render(
      <Field id="a" label="Amount" hint="A hint">
        <input id="a" />
      </Field>,
    );
    expect(screen.getByText("A hint")).toHaveAttribute("id", "a-hint");
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(
      <Field id="a" label="Amount" hint="A hint" error="Too small">
        <input id="a" />
      </Field>,
    );
    expect(screen.queryByText("A hint")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Too small");
  });
});

describe("Input / Textarea", () => {
  it("is labelled and links the hint", () => {
    render(<Input id="n" label="Name" hint="Your name" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-describedby", "n-hint");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("flags an error with aria-invalid and the error id", () => {
    render(<Input id="n" label="Name" error="Required" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "n-error");
    expect(input.className).toContain("border-danger");
  });

  it("passes native props through", () => {
    render(<Input id="n" label="Name" placeholder="Ada" maxLength={5} />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("maxlength", "5");
  });

  it("Textarea behaves the same way", () => {
    render(<Textarea id="m" label="Message" error="Too short" rows={4} />);
    const area = screen.getByLabelText("Message");
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(area).toHaveAttribute("aria-describedby", "m-error");
  });
});

describe("Select", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
  ];

  it("renders every option and reports changes", () => {
    const onChange = vi.fn();
    render(<Select id="s" label="Pick" options={options} value="a" onChange={onChange} />);
    const select = screen.getByLabelText("Pick") as HTMLSelectElement;
    expect(within(select).getAllByRole("option")).toHaveLength(2);
    fireEvent.change(select, { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("flags an error", () => {
    render(<Select id="s" label="Pick" options={options} defaultValue="a" error="Choose one" />);
    expect(screen.getByLabelText("Pick")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose one");
  });
});

describe("Button / ButtonLink / Card", () => {
  it("Button defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });

  it("Button supports variants, disabled and clicks", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button variant="secondary" onClick={onClick}>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button").className).toContain("border");

    rerender(
      <Button variant="ghost" disabled onClick={onClick}>
        Go
      </Button>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ButtonLink renders a real link", () => {
    render(<ButtonLink href="/about">About</ButtonLink>);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
  });

  it("Card merges classes and passes props through", () => {
    render(
      <Card className="extra" data-testid="card" role="note">
        Hi
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("extra");
    expect(card.className).toContain("rounded-card");
    expect(card).toHaveAttribute("role", "note");
  });
});

describe("Table", () => {
  it("has a caption, scoped column headers and a keyboard-scrollable region", () => {
    render(
      <Table caption="Payments">
        <thead>
          <tr>
            <Th>Month</Th>
            <Th align="right">Amount</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>1</Td>
            <Td align="right">$10</Td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByRole("table", { name: "Payments" })).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Payments" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region.className).toContain("overflow-x-auto");
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveAttribute("scope", "col");
    expect(headers[1].className).toContain("text-right");
    expect(screen.getByRole("cell", { name: "$10" }).className).toContain("text-right");
  });
});

describe("Accordion", () => {
  it("renders one native disclosure per item, closed by default", () => {
    const { container } = render(
      <Accordion
        items={[
          { question: "Why?", answer: "Because." },
          { question: "How?", answer: "Like this." },
        ]}
      />,
    );
    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(2);
    expect(details[0]).not.toHaveAttribute("open");
    expect(screen.getByText("Why?").closest("summary")).not.toBeNull();
    expect(screen.getByText("Because.")).toBeInTheDocument();
  });
});

describe("Tabs", () => {
  const items = [
    { id: "one", label: "One", content: <p>First panel</p> },
    { id: "two", label: "Two", content: <p>Second panel</p> },
    { id: "three", label: "Three", content: <p>Third panel</p> },
  ];

  it("selects the first tab and shows only its panel", () => {
    render(<Tabs label="Demo" items={items} />);
    expect(screen.getByRole("tablist", { name: "Demo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("First panel")).toBeVisible();
    expect(screen.getByText("Second panel")).not.toBeVisible();
  });

  it("uses a roving tabindex and links tabs to panels", () => {
    render(<Tabs label="Demo" items={items} />);
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("tabindex", "-1");
    const tab = screen.getByRole("tab", { name: "One" });
    const panel = document.getElementById(tab.getAttribute("aria-controls")!)!;
    expect(panel).toHaveAttribute("role", "tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("switches on click", () => {
    render(<Tabs label="Demo" items={items} />);
    fireEvent.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByText("Second panel")).toBeVisible();
    expect(screen.getByText("First panel")).not.toBeVisible();
  });

  it("moves with the arrow keys, wrapping at both ends, and with Home and End", () => {
    render(<Tabs label="Demo" items={items} />);
    const tab = (name: string) => screen.getByRole("tab", { name });

    fireEvent.keyDown(tab("One"), { key: "ArrowRight" });
    expect(tab("Two")).toHaveAttribute("aria-selected", "true");
    expect(tab("Two")).toHaveFocus();

    fireEvent.keyDown(tab("Two"), { key: "ArrowRight" });
    fireEvent.keyDown(tab("Three"), { key: "ArrowRight" }); // wraps to the start
    expect(tab("One")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("One"), { key: "ArrowLeft" }); // wraps to the end
    expect(tab("Three")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("Three"), { key: "Home" });
    expect(tab("One")).toHaveFocus();
    fireEvent.keyDown(tab("One"), { key: "End" });
    expect(tab("Three")).toHaveFocus();
  });

  it("ignores other keys", () => {
    render(<Tabs label="Demo" items={items} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "One" }), { key: "a" });
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
  });
});
