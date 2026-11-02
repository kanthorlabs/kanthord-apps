import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StageBar } from "./stage-bar";

describe("StageBar", () => {
  it("names the bar with the given label and draws one part for each segment", () => {
    render(
      <StageBar
        label="Executing settled executions: 331 forward, 9 loops, 68 leaks"
        bar={[
          { kind: "forward", count: 331, severity: "ok" },
          { kind: "loops", count: 9, severity: "ok" },
          { kind: "leaks", count: 68, severity: "ok" },
        ]}
      />,
    );

    const bar = screen.getByRole("img", {
      name: "Executing settled executions: 331 forward, 9 loops, 68 leaks",
    });
    expect(bar.children).toHaveLength(3);
  });
});
