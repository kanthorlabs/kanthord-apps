import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FlowRead } from "@/api/types";
import { flowFiltersOf } from "@/lib/flow-query";

import flowRead from "../../../../test/flow-read.json";
import { FlowSection } from "./flow-section";

const FLOW_READ = flowRead as unknown as FlowRead;
const FILTERS = flowFiltersOf(new URLSearchParams());
const STAGE_NAMES = [
  "Queued",
  "Executing",
  "Verification",
  "Release gate",
  "Evaluation",
  "Outcome",
];

function renderSection() {
  return render(
    <MemoryRouter>
      <FlowSection read={FLOW_READ} filters={FILTERS} />
    </MemoryRouter>,
  );
}

function stubWidth(width: number) {
  vi.stubGlobal("innerWidth", width);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FlowSection on a wide screen", () => {
  it("shows the six columns in stage order", () => {
    renderSection();

    const names = screen
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(STAGE_NAMES);
  });

  it("shows the headlines of the six key signals", () => {
    renderSection();

    for (const headline of [
      "wait p90 10 min 7d",
      "leak rate 16.7 % 7d",
      "flaky runs 22.0 % Oct 29",
      "leak rate 2.0 % 7d",
      "review p90 2.7 h Oct 29",
      "rework 27.8 % 7d",
    ]) {
      expect(screen.getByText(headline)).toBeInTheDocument();
    }
  });

  it("shows the bad icon on Verification and the warn icon on Evaluation only", () => {
    renderSection();

    expect(screen.getByRole("img", { name: "Verification status bad" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Evaluation status warn" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /status/ })).toHaveLength(2);
  });

  it("shows the exception slots and the exit summaries", () => {
    renderSection();

    for (const text of [
      "◐ provider errors 118 · Oct 27",
      "◐ revision loops 0.81 · Oct 29",
      "◐ leak 20.0 % · Oct 27",
      "◐ blocked 5.3 % · Oct 28",
      "↓ 68 ↺ 9",
      "↓ 7 ↺ 17",
      "↓ 5 → 300",
      "↓ 25",
      "✓ 183 ↺ 74 ↓ 9",
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("gives an ended exception a text for a screen reader", () => {
    renderSection();

    expect(screen.getByText("◐ provider errors 118 · Oct 27")).toHaveTextContent(/ ended$/);
    expect(screen.getByText("◐ revision loops 0.81 · Oct 29")).not.toHaveTextContent(/ ended$/);
  });

  it("shows the entered line and the loop line", () => {
    renderSection();

    expect(screen.getAllByText("412 in")).toHaveLength(2);
    expect(screen.getByText("281 in")).toBeInTheDocument();
    expect(screen.getByText("↺ 100 loops re-enter Queued")).toBeInTheDocument();
  });

  it("shows the legend with the present states", () => {
    renderSection();

    const legend = screen.getByRole("list", { name: "Legend" });
    const items = within(legend)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items).toContain("◔today, partial");
    expect(items).toContain("✓success");
  });

  it("shows separators and the hand-off divider", () => {
    renderSection();

    expect(screen.getAllByText("›")).toHaveLength(4);
    expect(screen.getByText("hand-off")).toBeInTheDocument();
  });

  it("shows the axis under the Queued strip only", () => {
    renderSection();

    const axisStart = screen.getByText("Oct 24");
    const axisEnd = screen.getByText("30 ◔");
    const queued = screen.getByRole("grid", { name: "wait p90" });
    const [executing] = screen.getAllByRole("grid", { name: "leak rate" });
    expect(screen.getAllByText("Oct 24")).toHaveLength(1);
    expect(queued.compareDocumentPosition(axisStart)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(axisEnd.compareDocumentPosition(executing as HTMLElement)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("opens the four bands of all six columns with Details", async () => {
    const user = userEvent.setup();
    renderSection();
    const toggle = screen.getByRole("button", { name: "Details ▾" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("pass 81.1 %")).toBeNull();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("pass 81.1 %")).toBeInTheDocument();
    expect(screen.getByText("success 68.8 %")).toBeInTheDocument();
    expect(screen.getByText("18 min / 2.4 h")).toBeInTheDocument();
    expect(screen.getByText("prev p90 31 min")).toBeInTheDocument();
    expect(screen.getByText(/unrecorded 14/)).toBeInTheDocument();
    expect(screen.getAllByText("50 passed with no telemetry (claude-code@1)")).toHaveLength(2);
    for (const title of ["Exits", "Time p50 / p90", "Signals (previous)", "Not in rates"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      for (const name of STAGE_NAMES) {
        expect(screen.getByRole("group", { name: `${name} ${title}` })).toBeInTheDocument();
      }
    }
  });

  it("labels the Executing cell of Oct 27 and links it to Traces", () => {
    renderSection();

    const cell = screen.getByRole("link", { name: "Oct 27: leak rate 43.0 %, bad" });
    expect(cell).toHaveAttribute("href", "/traces?state=error&from=1793059200000&to=1793145600000");
  });

  it("gives each strip the role grid with one row and seven cells", () => {
    renderSection();

    const grids = screen.getAllByRole("grid");
    expect(grids).toHaveLength(6);
    for (const grid of grids) {
      expect(within(grid).getAllByRole("row")).toHaveLength(1);
      expect(within(grid).getAllByRole("gridcell")).toHaveLength(7);
    }
  });

  it("makes each strip one tab stop and moves the focus with the arrow keys", async () => {
    const user = userEvent.setup();
    renderSection();
    const grid = screen.getByRole("grid", { name: "flaky runs" });
    const cells = within(grid).getAllByRole("link");
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);

    cells[0]?.focus();
    await user.keyboard("{ArrowRight}");
    expect(cells[1]).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowLeft}{ArrowLeft}");
    expect(cells[0]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(cells[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(cells.filter((cell) => cell.tabIndex === 0)).toEqual([cells[1]]);
  });
});

describe("FlowSection on a narrow screen", () => {
  it("shows six rows and no Details toggle", async () => {
    stubWidth(390);
    renderSection();

    const buttons = await screen.findAllByRole("button", { name: / details$/ });
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(
      STAGE_NAMES.map((name) => `${name} details`),
    );
    expect(buttons.map((button) => button.textContent)).toEqual(Array(6).fill("▸"));
    expect(screen.queryByRole("button", { name: "Details ▾" })).toBeNull();
    expect(screen.getByText("↓ 68 ↺ 9")).toBeInTheDocument();
    expect(screen.getByText("↺ 100 loops re-enter Queued")).toBeInTheDocument();
  });

  it("opens only the bands of the row that its button names", async () => {
    stubWidth(390);
    const user = userEvent.setup();
    renderSection();
    const button = await screen.findByRole("button", { name: "Verification details" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("pass 91.4 %")).toBeInTheDocument();
    expect(screen.getByText("50 passed with no telemetry (claude-code@1)")).toBeInTheDocument();
    expect(screen.queryByText("pass 81.1 %")).toBeNull();
    expect(screen.getByRole("button", { name: "Executing details" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
