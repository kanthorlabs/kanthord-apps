import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StageBar } from "./stage-bar";

describe("StageBar", () => {
  it("names the settled executions of each segment", () => {
    render(
      <StageBar
        name="Executing"
        bar={[
          { kind: "forward", count: 331, severity: "ok" },
          { kind: "loops", count: 9, severity: "ok" },
          { kind: "leaks", count: 68, severity: "ok" },
        ]}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Executing settled executions: 331 forward, 9 loops, 68 leaks",
      }),
    ).toBeInTheDocument();
  });

  it("names the status of an active segment", () => {
    render(
      <StageBar
        name="Outcome"
        bar={[
          { kind: "forward", count: 183, severity: "ok" },
          { kind: "loops", count: 74, severity: "bad" },
        ]}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Outcome settled executions: 183 forward, 74 loops (bad)",
      }),
    ).toBeInTheDocument();
  });

  it("names an empty bar", () => {
    render(<StageBar name="Queued" bar={[]} />);

    expect(
      screen.getByRole("img", { name: "Queued settled executions: none" }),
    ).toBeInTheDocument();
  });
});
