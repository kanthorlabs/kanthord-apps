import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sparkline } from "./sparkline";

const VALUES = [0.09, 0.12, 0.43, 0.11, 0.1];

describe("Sparkline", () => {
  it("names the line with the range and both bounds", () => {
    render(<Sparkline values={VALUES} partial={false} warn={0.15} bad={0.25} label="leak rate" />);

    expect(
      screen.getByRole("img", {
        name: "Daily leak rate from 0.09 to 0.43, warn line 0.15, bad line 0.25",
      }),
    ).toBeInTheDocument();
  });

  it("names only the bad bound when the warn bound is absent", () => {
    render(<Sparkline values={VALUES} partial={false} bad={0.25} label="leak rate" />);

    expect(
      screen.getByRole("img", { name: "Daily leak rate from 0.09 to 0.43, bad line 0.25" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/warn line/)).toBeNull();
  });

  it("names the range alone when no bound is given", () => {
    render(<Sparkline values={VALUES} partial={false} label="leak rate" />);

    expect(
      screen.getByRole("img", { name: "Daily leak rate from 0.09 to 0.43" }),
    ).toBeInTheDocument();
  });

  it("formats the numbers of the name with the given format", () => {
    render(
      <Sparkline
        values={[60_000, 120_000]}
        partial={false}
        label="wait p90"
        format={(value) => `${value / 60_000} min`}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Daily wait p90 from 1 min to 2 min" }),
    ).toBeInTheDocument();
  });

  it("skips a null value in the range of the name", () => {
    render(<Sparkline values={[null, 0.2, 0.4]} partial={false} label="flaky runs" />);

    expect(
      screen.getByRole("img", { name: "Daily flaky runs from 0.2 to 0.4" }),
    ).toBeInTheDocument();
  });

  it("draws the warn bound dashed and the bad bound dotted", () => {
    render(<Sparkline values={VALUES} partial={false} warn={0.15} bad={0.25} label="leak rate" />);

    expect(screen.getByLabelText("warn line 0.15")).toHaveAttribute("stroke-dasharray", "4 3");
    expect(screen.getByLabelText("bad line 0.25")).toHaveAttribute("stroke-dasharray", "1 3");
  });

  it("draws the partial last segment dashed and the last point hollow", () => {
    render(<Sparkline values={VALUES} partial label="leak rate" />);

    expect(screen.getByLabelText("Partial bucket")).toHaveAttribute("stroke-dasharray", "3 3");
    expect(screen.getByLabelText("Last point, partial bucket")).toHaveAttribute("fill", "none");
  });

  it("draws no dashed segment and a filled last point for a full last bucket", () => {
    render(<Sparkline values={VALUES} partial={false} label="leak rate" />);

    expect(screen.queryByLabelText("Partial bucket")).toBeNull();
    expect(screen.queryByLabelText("Last point, partial bucket")).toBeNull();
  });

  it("draws the slice line and ends it with the slice key", () => {
    render(
      <Sparkline
        values={VALUES}
        partial={false}
        label="leak rate"
        slice={{ key: "coder@1", values: [0.3, 0.35, 0.6, 0.3, 0.3], severity: "bad" }}
      />,
    );

    expect(screen.getByText("coder@1")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Daily leak rate from 0.09 to 0.43" }),
    ).toBeInTheDocument();
  });

  it("draws no slice label without a slice", () => {
    render(<Sparkline values={VALUES} partial={false} label="leak rate" />);

    expect(screen.queryByText("coder@1")).toBeNull();
  });
});
