import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";
import { frameOf } from "@/lib/flow-status";
import { stopMatrixOf } from "@/lib/flow-stop-reasons";

import flowRead from "../../../../test/flow-read.json";
import { StopReasonMatrix } from "./stop-reason-matrix";

const FLOW_READ = flowRead as unknown as FlowRead;

function renderMatrix(read: FlowRead = FLOW_READ) {
  return render(
    <MemoryRouter>
      <StopReasonMatrix matrix={stopMatrixOf(read, frameOf(read, "7d"))} />
    </MemoryRouter>,
  );
}

function rowOf(name: string): HTMLElement {
  const header = screen.getByRole("rowheader", { name });
  return header.closest("[role=row]") as HTMLElement;
}

function cellTexts(name: string): readonly (string | null)[] {
  return within(rowOf(name))
    .getAllByRole("gridcell")
    .map((cell) => cell.textContent);
}

describe("StopReasonMatrix", () => {
  it("is a grid in its own scroll box", () => {
    renderMatrix();

    expect(screen.getByRole("grid", { name: "Stop reasons" }).parentElement).toHaveClass(
      "overflow-x-auto",
    );
  });

  it("heads the grid with the month, the day numbers, the partial mark, Total and Prev", () => {
    renderMatrix();

    const [header] = screen.getAllByRole("row");
    expect(
      within(header as HTMLElement)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Oct", "24", "25", "26", "27", "28", "29", "30 ◔", "Total", "Prev"]);
    expect(screen.getByRole("img", { name: "partial day" })).toBeInTheDocument();
  });

  it("lists the reasons, All failures, the divider and budget_end in order", () => {
    renderMatrix();

    expect(screen.getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual([
      "operation_failed",
      "judgement_invalid",
      "report_absent",
      "action_unsettled",
      "assessment_absent",
      "provider_failed",
      "no_progress",
      "environment_failed",
      "lost",
      "All failures",
      "budget_end",
    ]);
    const divider = screen.getByText("not a failure");
    const all = rowOf("All failures");
    const budget = rowOf("budget_end");
    expect(all.compareDocumentPosition(divider)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(divider.compareDocumentPosition(budget)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("reads the All failures row in bold with total 97 and previous 58", () => {
    renderMatrix();

    expect(cellTexts("All failures")).toEqual(["9", "9", "9", "43", "9", "10", "8", "97", "58"]);
    expect(rowOf("All failures")).toHaveClass("font-semibold");
  });

  it("shows ▲ 39 against 9 for provider_failed and 28 on Oct 27", () => {
    renderMatrix();

    expect(cellTexts("provider_failed")).toEqual(["2", "2", "1", "28", "2", "2", "2", "▲ 39", "9"]);
    expect(screen.getByRole("link", { name: "provider_failed Oct 27: 28" })).toHaveAttribute(
      "href",
      "/traces?q=provider_failed&from=1793059200000&to=1793145600000",
    );
  });

  it("shows a dot that reads 0 for a zero cell", () => {
    renderMatrix();

    const zero = within(rowOf("lost")).getAllByRole("img", { name: "0" })[0];
    expect(zero).toHaveTextContent("·");
    expect(within(rowOf("lost")).queryAllByRole("link")).toHaveLength(4);
  });

  it("shades each cell by its count", () => {
    renderMatrix();

    const shaded = (label: string) =>
      screen.getByRole("link", { name: label }).closest("[role=gridcell]");
    expect(shaded("provider_failed Oct 27: 28")).toHaveClass("bg-flow-seq-5", "text-background");
    expect(shaded("operation_failed Oct 27: 4")).toHaveClass("bg-flow-seq-2");
    expect(shaded("operation_failed Oct 24: 3")).toHaveClass("bg-flow-seq-2");
    expect(shaded("lost Oct 25: 1")).toHaveClass("bg-flow-seq-1", "text-foreground");
  });

  it("keeps one tab stop and moves the focus with the arrow keys", async () => {
    const user = userEvent.setup();
    renderMatrix();
    const links = screen.getAllByRole("link");
    expect(links.filter((link) => link.tabIndex === 0)).toHaveLength(1);

    await user.tab();
    const first = document.activeElement as HTMLElement;
    expect(first).toHaveAccessibleName("operation_failed Oct 24: 3");

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toHaveAccessibleName("operation_failed Oct 25: 2");

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toHaveAccessibleName("judgement_invalid Oct 25: 1");

    await user.keyboard("{ArrowLeft}{ArrowUp}");
    expect(document.activeElement).toHaveAccessibleName("operation_failed Oct 24: 3");
    expect(links.filter((link) => link.tabIndex === 0)).toHaveLength(1);
  });

  it("skips a zero cell and stays at the edge", async () => {
    const user = userEvent.setup();
    renderMatrix();

    await user.click(screen.getByRole("link", { name: "judgement_invalid Oct 29: 1" }));
    await user.keyboard("{ArrowRight}");

    expect(document.activeElement).toHaveAccessibleName("judgement_invalid Oct 29: 1");
  });

  it("keeps the first column in view with a sticky header", () => {
    renderMatrix();

    expect(screen.getByRole("rowheader", { name: "lost" })).toHaveClass("sticky", "left-0");
  });
});
