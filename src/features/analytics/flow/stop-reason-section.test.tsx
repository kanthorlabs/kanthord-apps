import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";

import flowRead from "../../../../test/flow-read.json";
import { StopReasonSection, StopReasonSkeleton } from "./stop-reason-section";

const FLOW_READ = flowRead as unknown as FlowRead;

function renderSection(read: FlowRead = FLOW_READ) {
  return render(
    <MemoryRouter>
      <StopReasonSection read={read} filters={{ range: "7d" }} />
    </MemoryRouter>,
  );
}

describe("StopReasonSection", () => {
  it("reads the heading with the stopped and budget totals", () => {
    renderSection();

    expect(screen.getByRole("heading", { name: "Stop reasons" })).toBeInTheDocument();
    expect(screen.getByText("97 stopped · 23 budget ends")).toBeInTheDocument();
  });

  it("shows the matrix", () => {
    renderSection();

    expect(screen.getByRole("grid", { name: "Stop reasons" })).toBeInTheDocument();
  });

  it("confirms both sums under the matrix", () => {
    renderSection();

    expect(
      screen.getByText(
        "Σ above the divider 97 = ↓ stopped exits ✓ · budget_end 23 = ↺ budget loops ✓",
      ),
    ).toBeInTheDocument();
  });

  it("warns under the matrix when a sum differs from the exits", () => {
    const read = {
      ...FLOW_READ,
      stop_reasons: {
        ...FLOW_READ.stop_reasons,
        rows: { ...FLOW_READ.stop_reasons.rows, budget_end: [2, 2, 2, 2, 4, 5, 7] },
      },
    };
    renderSection(read);

    expect(screen.getByText(/budget_end 24 = ↺ budget loops ⚠ 24 ≠ 23/)).toBeInTheDocument();
  });
});

describe("StopReasonSkeleton", () => {
  it("announces the loading state", () => {
    render(<StopReasonSkeleton />);

    expect(screen.getByRole("status", { name: "Loading the stop reasons" })).toBeInTheDocument();
  });
});
