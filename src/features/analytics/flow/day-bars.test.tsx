import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DayBars } from "./day-bars";

const VALUES = [10, 20, 40];

describe("DayBars", () => {
  it("names the range of the daily cost", () => {
    render(<DayBars values={VALUES} scale={40} partial={false} label="qwen3-coder" />);

    expect(
      screen.getByRole("img", { name: "Daily cost of qwen3-coder from $10.00 to $40.00" }),
    ).toBeInTheDocument();
  });

  it("draws one bar for each bucket", () => {
    const { container } = render(<DayBars values={VALUES} scale={40} partial={false} label="x" />);

    expect(container.querySelectorAll("rect")).toHaveLength(3);
  });

  it("draws the bar height against the shared scale", () => {
    const { container } = render(
      <DayBars values={[10, 20]} scale={40} partial={false} label="x" />,
    );

    const heights = [...container.querySelectorAll("rect")].map((bar) =>
      Number(bar.getAttribute("height")),
    );
    expect(heights).toEqual([6, 12]);
  });

  it("fades only the partial last bucket", () => {
    const { container } = render(<DayBars values={VALUES} scale={40} partial label="x" />);

    const opacities = [...container.querySelectorAll("rect")].map((bar) =>
      bar.getAttribute("fill-opacity"),
    );
    expect(opacities).toEqual(["1", "1", "0.35"]);
    expect(screen.getByLabelText("Partial bucket")).toBeInTheDocument();
  });

  it("keeps every bar solid when the last bucket is full", () => {
    render(<DayBars values={VALUES} scale={40} partial={false} label="x" />);

    expect(screen.queryByLabelText("Partial bucket")).toBeNull();
  });

  it("names an empty series", () => {
    render(<DayBars values={[]} scale={0} partial={false} label="idle" />);

    expect(
      screen.getByRole("img", { name: "Daily cost of idle has no values" }),
    ).toBeInTheDocument();
  });
});
