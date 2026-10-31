import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { FlowRead } from "@/api/types";
import { paretoOf } from "@/lib/flow-causes";

import flowRead from "../../../../test/flow-read.json";
import { ParetoRows } from "./pareto-rows";

const FLOW_READ = flowRead as unknown as FlowRead;
const OPTIONS = { stage: null, includeBudget: false, scope: { projectId: null, workerName: null } };

interface RenderOptions {
  readonly read?: FlowRead;
  readonly open?: string | null;
  readonly onToggle?: (category: string) => void;
}

function renderPareto({
  read = FLOW_READ,
  open = null,
  onToggle = () => undefined,
}: RenderOptions) {
  return render(
    <MemoryRouter>
      <ParetoRows
        model={paretoOf(read, OPTIONS)}
        open={open}
        truncated={read.causes.truncated}
        onToggle={onToggle}
      />
    </MemoryRouter>,
  );
}

function cellsOf(name: string): readonly string[] {
  const header = screen.getByRole("rowheader", { name: new RegExp(name) });
  const row = header.closest("[role=row]") as HTMLElement;
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent ?? "");
}

describe("ParetoRows", () => {
  it("is a table with the seven column headers", () => {
    renderPareto({});

    const table = screen.getByRole("table", { name: "Causes" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers).toEqual([
      "Cause",
      "Count and bar",
      "Suspected",
      "Cost",
      "Prev",
      "Cum %",
      "Traces",
    ]);
  });

  it("sits in its own scroll box", () => {
    renderPareto({});

    expect(screen.getByRole("table", { name: "Causes" }).parentElement).toHaveClass(
      "overflow-x-auto",
    );
  });

  it("reads the rows of the fixture", () => {
    renderPareto({});

    expect(cellsOf("llm_provider")).toEqual(["▲ 39", "", "$4.40", "13", "21 %", "Traces →"]);
    expect(cellsOf("model")).toEqual(["35", "+64 suspected", "$9.40", "34", "39 %", "Traces →"]);
    expect(cellsOf("environment")).toEqual([
      "16",
      "+4 suspected",
      "$6.90",
      "13",
      "48 %",
      "Traces →",
    ]);
    expect(cellsOf("infrastructure")).toEqual([
      "9",
      "+6 suspected",
      "$10.00",
      "10",
      "53 %",
      "Traces →",
    ]);
    expect(cellsOf("human")).toEqual(["5", "", "$2.80", "3", "55 %", "Traces →"]);
    expect(cellsOf("plan")).toEqual(["3", "+5 suspected", "$0.90", "2", "57 %", "Traces →"]);
    expect(cellsOf("worker_action")).toEqual(["0", "+2 suspected", "$0.00", "—", "—", ""]);
  });

  it("puts unattributed last with a hatched bar", () => {
    renderPareto({});

    const rows = screen.getAllByRole("row");
    const last = rows.at(-1) as HTMLElement;
    expect(within(last).getByRole("rowheader")).toHaveTextContent("unattributed");
    expect(cellsOf("unattributed")).toEqual(["81", "", "$30.60", "48", "100 %", "Traces →"]);
    expect(last.querySelector(".bg-flow-hatch")).not.toBeNull();
    expect(screen.getAllByRole("table")[0]?.querySelectorAll(".bg-flow-hatch")).toHaveLength(1);
  });

  it("reads more than doubled for a screen reader", () => {
    renderPareto({});

    expect(screen.getByRole("img", { name: "more than doubled" })).toHaveTextContent("▲");
    expect(screen.getAllByRole("img", { name: "more than doubled" })).toHaveLength(1);
  });

  it("links each category with a count to its traces", () => {
    renderPareto({});

    expect(screen.getByRole("link", { name: "Traces of model" })).toHaveAttribute(
      "href",
      "/traces?cause_category=model&from=1792800000000&to=1793369520000",
    );
    expect(screen.queryByRole("link", { name: "Traces of worker_action" })).toBeNull();
  });

  it("gives a category with details a toggle button and none to unattributed", () => {
    renderPareto({});

    expect(screen.getByRole("button", { name: "▸ model" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("button", { name: /unattributed/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /worker_action/ })).toBeNull();
  });

  it("reports the category of a click", async () => {
    const onToggle = vi.fn();
    renderPareto({ onToggle });

    await userEvent.setup().click(screen.getByRole("button", { name: "▸ model" }));

    expect(onToggle).toHaveBeenCalledWith("model");
  });

  it("shows the detail rows of the open category with the split by assigner", () => {
    renderPareto({ open: "infrastructure" });

    expect(screen.getByRole("button", { name: "▸ infrastructure" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const details = screen.getByRole("list", { name: "Details of infrastructure" });
    expect(
      within(details)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["execution_lost4rule 4", "verification_killed3rule 3", "network2manual label 2"]);
  });

  it("hides the detail rows of a closed category", () => {
    renderPareto({});

    expect(screen.queryByRole("list", { name: "Details of model" })).toBeNull();
  });

  it("says that more cause rows exist when the read is truncated", () => {
    const read = { ...FLOW_READ, causes: { ...FLOW_READ.causes, truncated: true } };
    renderPareto({ read });

    expect(
      screen.getByText("More cause rows exist. Narrow the range or the filter."),
    ).toBeInTheDocument();
  });

  it("does not warn about truncation for a complete read", () => {
    renderPareto({});

    expect(screen.queryByText(/More cause rows exist/)).toBeNull();
  });

  it("says that no failures happened without caused rows", () => {
    const read = { ...FLOW_READ, causes: { ...FLOW_READ.causes, rows: [] } };
    renderPareto({ read });

    expect(screen.getByText("No failures in this range.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
