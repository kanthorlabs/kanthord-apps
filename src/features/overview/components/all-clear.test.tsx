import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AllClear } from "./all-clear";

describe("AllClear", () => {
  it("shows the clear text and the focus target", () => {
    const titleRef = vi.fn();
    render(<AllClear titleRef={titleRef} />);

    expect(screen.getByText("All clear")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("No decision waits for you.")).toBeVisible();
    expect(titleRef).toHaveBeenCalledWith(screen.getByText("All clear"));
  });

  it("shows the workforce fact", () => {
    render(<AllClear titleRef={() => undefined} workforce="0 executions run · 0 jobs wait" />);

    expect(screen.getByText("0 executions run · 0 jobs wait")).toBeVisible();
  });

  it("shows no act found on a fault", () => {
    render(<AllClear titleRef={() => undefined} fault />);

    expect(screen.getByText("No act found")).toBeVisible();
    expect(screen.getByText("Some records could not be read.")).toBeVisible();
    expect(screen.queryByText("All clear")).not.toBeInTheDocument();
  });
});
