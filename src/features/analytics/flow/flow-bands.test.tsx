import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FlowRead, FlowStage } from "@/api/types";
import { type FlowColumn, flowOf } from "@/lib/flow-stages";
import { frameOf } from "@/lib/flow-status";

import flowRead from "../../../../test/flow-read.json";
import { FlowBandRows, StageBands } from "./flow-bands";

const FLOW_READ = flowRead as unknown as FlowRead;
const MODEL = flowOf(FLOW_READ, frameOf(FLOW_READ, "7d"), { projectId: null, workerName: null });

function columnOf(stage: FlowStage): FlowColumn {
  const column = MODEL.columns.find((candidate) => candidate.stage === stage);
  if (column === undefined) throw new Error(`No column ${stage}`);
  return column;
}

describe("StageBands", () => {
  it("shows the four bands of Evaluation", () => {
    render(<StageBands column={columnOf("evaluation")} />);

    expect(screen.getByText("pass 91.4 %")).toBeInTheDocument();
    expect(screen.getByText("↓ 21 stopped")).toBeInTheDocument();
    expect(screen.getByText("review wait")).toBeInTheDocument();
    expect(screen.getByText("18 min / 2.4 h")).toBeInTheDocument();
    expect(screen.getByText("prev p90 31 min")).toBeInTheDocument();
    expect(screen.getByText(/decided at: judgement 38/)).toBeInTheDocument();
    expect(screen.getByText("○ 5 open")).toBeInTheDocument();
  });

  it("ends each signal line with the status for a screen reader", () => {
    render(<StageBands column={columnOf("verification")} />);

    const group = screen.getByRole("group", { name: "Verification Signals (previous)" });
    const flaky = within(group).getByText("flaky runs 12.2 % (4.6 %) · since Oct 28");
    expect(flaky.parentElement).toHaveTextContent(/, bad$/);
  });

  it("names the status of an active time signal for a screen reader", () => {
    render(<StageBands column={columnOf("evaluation")} />);

    const group = screen.getByRole("group", { name: "Evaluation Time p50 / p90" });
    expect(group).toHaveTextContent("warn");
  });

  it("shows a dash for Queued exits and Outcome Not in rates", () => {
    const { unmount } = render(<StageBands column={columnOf("queued")} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
    unmount();

    render(<StageBands column={columnOf("outcome")} />);
    expect(screen.getByText("↺ 74 rework → Queued")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Outcome Not in rates" });
    expect(within(group).getByText("—")).toBeInTheDocument();
  });
});

describe("FlowBandRows", () => {
  it("shows one row for each band with one cell for each column", () => {
    render(<FlowBandRows columns={MODEL.columns} gridClassName="grid" />);

    expect(
      screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent),
    ).toEqual(["Exits", "Time p50 / p90", "Signals (previous)", "Not in rates"]);
    expect(screen.getAllByRole("group", { name: /Exits$/ })).toHaveLength(6);
    expect(screen.getAllByRole("group")).toHaveLength(24);
  });
});
