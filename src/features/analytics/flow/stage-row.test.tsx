import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";
import { flowOf } from "@/lib/flow-stages";
import { frameOf } from "@/lib/flow-status";

import flowRead from "../../../../test/flow-read.json";
import { StageRow } from "./stage-row";

const FLOW_READ = flowRead as unknown as FlowRead;
const MODEL = flowOf(FLOW_READ, frameOf(FLOW_READ, "7d"), { projectId: null, workerName: null });
const OUTCOME = MODEL.columns[5];

function renderRow() {
  if (OUTCOME === undefined) throw new Error("No outcome column");
  return render(
    <MemoryRouter>
      <ol>
        <StageRow column={OUTCOME} />
      </ol>
    </MemoryRouter>,
  );
}

describe("StageRow", () => {
  it("shows the name, the entered line, the headline, the strip, the bar and the exits", () => {
    renderRow();

    expect(screen.getByRole("heading", { name: "Outcome" })).toBeInTheDocument();
    expect(screen.getByText("266 in")).toBeInTheDocument();
    expect(screen.getByText("rework 27.8 % 7d")).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "rework rate" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Outcome settled executions/ })).toBeInTheDocument();
    expect(screen.getByText("✓ 183 ↺ 74 ↓ 9")).toBeInTheDocument();
  });

  it("opens and closes the bands with the button", async () => {
    const user = userEvent.setup();
    renderRow();
    const button = screen.getByRole("button", { name: "Outcome details" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("success 68.8 %")).toBeNull();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("success 68.8 %")).toBeInTheDocument();
    expect(screen.getByText("success 183 (176)")).toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
