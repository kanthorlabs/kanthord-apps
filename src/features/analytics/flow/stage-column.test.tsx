import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { FlowRead, FlowStage } from "@/api/types";
import { type FlowColumn, flowOf } from "@/lib/flow-stages";
import { frameOf } from "@/lib/flow-status";

import flowRead from "../../../../test/flow-read.json";
import { StageColumn } from "./stage-column";

const FLOW_READ = flowRead as unknown as FlowRead;
const MODEL = flowOf(FLOW_READ, frameOf(FLOW_READ, "7d"), { projectId: null, workerName: null });

function columnOf(stage: FlowStage): FlowColumn {
  const column = MODEL.columns.find((candidate) => candidate.stage === stage);
  if (column === undefined) throw new Error(`No column ${stage}`);
  return column;
}

function renderColumn(stage: FlowStage, showAxis = false) {
  return render(
    <MemoryRouter>
      <StageColumn column={columnOf(stage)} showAxis={showAxis} />
    </MemoryRouter>,
  );
}

describe("StageColumn", () => {
  it("shows the name, the icon, the headline, the exception and the lines of Verification", () => {
    renderColumn("verification");

    expect(screen.getByRole("heading", { name: "Verification" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Verification status bad" })).toBeInTheDocument();
    expect(screen.getByText("flaky runs 22.0 % Oct 29")).toBeInTheDocument();
    expect(screen.getByText("◐ revision loops 0.81 · Oct 29")).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "flaky runs" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Verification settled executions: 256 forward, 17 loops, 7 leaks",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("↓ 7 ↺ 17")).toBeInTheDocument();
    expect(screen.getByText("281 in")).toBeInTheDocument();
  });

  it("shows no icon and an empty exception slot for Queued", () => {
    renderColumn("queued");

    expect(screen.queryByRole("img", { name: /status/ })).toBeNull();
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it("shows the axis only when asked", () => {
    const { unmount } = renderColumn("queued", true);
    expect(screen.getByText("Oct 24")).toBeInTheDocument();
    unmount();

    renderColumn("queued");
    expect(screen.queryByText("Oct 24")).toBeNull();
  });

  it("gives a muted exception a text for a screen reader", () => {
    renderColumn("executing");

    expect(screen.getByText("◐ provider errors 118 · Oct 27")).toHaveTextContent(/ ended$/);
  });
});
