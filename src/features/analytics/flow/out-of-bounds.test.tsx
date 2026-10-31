import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";
import { flowFiltersOf } from "@/lib/flow-query";

import flowRead from "../../../../test/flow-read.json";
import { OutOfBounds } from "./out-of-bounds";

const FLOW_READ = flowRead as unknown as FlowRead;
const FILTERS = flowFiltersOf(new URLSearchParams());
const ZEROS = (values: readonly unknown[]) => values.map(() => 0);

const QUIET_READ = {
  ...FLOW_READ,
  stages: FLOW_READ.stages.map((stage) => ({
    ...stage,
    current: { ...stage.current, exits: {}, signals: {}, time: null },
    previous: null,
    previous_bucket_median: {},
    dimensions: [],
    series: {
      ...stage.series,
      leaked: ZEROS(stage.series.leaked),
      loops: ZEROS(stage.series.loops),
      time_p90: stage.series.time_p90.map(() => null),
      signals: {},
    },
  })),
  causes: { ...FLOW_READ.causes, rows: [], previous_unattributed_share: null },
  usage: {
    ...FLOW_READ.usage,
    by: { ...FLOW_READ.usage.by, model: [] },
    series: {
      ...FLOW_READ.usage.series,
      cache_hit: FLOW_READ.usage.series.cache_hit.map(() => 0.9),
    },
    current: {
      ...FLOW_READ.usage.current,
      cache_read_tokens: FLOW_READ.usage.current.input_tokens * 0.9,
    },
    previous: null,
  },
  cost: {
    ...FLOW_READ.cost,
    previous: null,
    current: { ...FLOW_READ.cost.current, leaked_usd: 0 },
    series: { ...FLOW_READ.cost.series, leaked_usd: ZEROS(FLOW_READ.cost.series.leaked_usd) },
  },
  completeness: {
    ...FLOW_READ.completeness,
    awaiting_ingestion: [],
    exit_unknown: 0,
    no_root: 0,
  },
} as unknown as FlowRead;

function renderOutOfBounds(read: FlowRead = FLOW_READ) {
  return render(
    <MemoryRouter>
      <OutOfBounds read={read} filters={FILTERS} />
    </MemoryRouter>,
  );
}

function rowsOf(): readonly HTMLElement[] {
  return within(screen.getByRole("list", { name: "Out of bounds" })).getAllByRole("listitem");
}

function fieldsOf(row: HTMLElement): Record<string, string | null> {
  const terms = within(row).getAllByRole("term");
  const details = within(row).getAllByRole("definition");
  return Object.fromEntries(
    terms.map((term, index) => [term.textContent, details[index]?.textContent ?? null]),
  );
}

describe("OutOfBounds", () => {
  it("reads the heading with the count of ongoing and range rows", () => {
    renderOutOfBounds();

    expect(
      screen.getByRole("heading", { name: "Out of bounds 4 ongoing · 2 in range" }),
    ).toBeInTheDocument();
  });

  it("lists the six rows in one list", () => {
    renderOutOfBounds();

    expect(rowsOf()).toHaveLength(6);
    expect(screen.getAllByRole("list", { name: "Out of bounds" })).toHaveLength(1);
  });

  it("names where and the metric in the title of each row", () => {
    renderOutOfBounds();

    const titles = [
      "Bad Verification · flaky runs",
      "Bad Tokens · cache hit ratio",
      "Warning Verification · revision loops",
      "Warning Evaluation · review wait p90",
      "Bad Why · unattributed share",
      "Warning Data · awaiting ingestion",
    ];
    rowsOf().forEach((row, index) => expect(row).toHaveTextContent(titles[index] ?? ""));
  });

  it("shows the five fields of the first row and its link", () => {
    renderOutOfBounds();
    const [first] = rowsOf();
    if (first === undefined) throw new Error("No row");

    expect(fieldsOf(first)).toEqual({
      Now: "22.0 % Oct 29",
      Bound: "bad > 15 %",
      Since: "since Oct 28",
      Slice: "auth-gateway",
      "Top cause": "environment.flaky_verification",
    });
    expect(within(first).getByRole("button", { name: "Traces →" })).toHaveAttribute(
      "href",
      "/traces?project_id=auth-gateway&from=1793145600000&to=1793369520000",
    );
  });

  it("shows a dash for a slice and a cause that a row lacks", () => {
    renderOutOfBounds();
    const fifth = rowsOf()[4];
    if (fifth === undefined) throw new Error("No row");

    expect(fieldsOf(fifth)).toMatchObject({ Slice: "—", "Top cause": "suspect model" });
  });

  it("links the tile group of a tile row to the Cost tab", () => {
    renderOutOfBounds();
    const second = rowsOf()[1];
    if (second === undefined) throw new Error("No row");

    expect(within(second).getByRole("link", { name: "Tokens" })).toHaveAttribute(
      "href",
      "/analytics?tab=cost&range=7d",
    );
    expect(within(second).getByRole("button", { name: "Traces →" })).toHaveAttribute(
      "href",
      "/traces?model=gpt-5-codex&sort=total_tokens&from=1793145600000&to=1793369520000",
    );
  });

  it("links the stage of a stage row to nothing", () => {
    renderOutOfBounds();
    const first = rowsOf()[0];
    if (first === undefined) throw new Error("No row");

    expect(within(first).queryByRole("link")).toBeNull();
  });

  it("starts with the ended groups closed", () => {
    renderOutOfBounds();

    const disclosure = screen.getByRole("button", { name: "▸ Ended in range (4)" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Ended in range" })).toBeNull();
  });

  it("shows the four group lines after the disclosure opens", async () => {
    const user = userEvent.setup();
    renderOutOfBounds();

    await user.click(screen.getByRole("button", { name: "▸ Ended in range (4)" }));

    expect(screen.getByRole("button", { name: "▸ Ended in range (4)" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const groups = within(screen.getByRole("list", { name: "Ended in range" })).getAllByRole(
      "listitem",
    );
    const lines = [
      "Oct 27 · Executing leak 43.0 % · provider errors 118 · Evaluation leak 20.0 % · cost per success $3.01 · leaked cost 23.6 % · tokens per success 4.95 M · coder@1 · llm_provider.rate_limited",
      "Oct 24 – Oct 28 · Outcome rework up to 38.9 % · model.work_defect",
      "Oct 25, Oct 27 – Oct 28 · Verification base red up to 7.3 %",
      "Oct 28 · Outcome blocked 5.3 % · model.work_defect",
    ];
    expect(groups).toHaveLength(4);
    groups.forEach((group, index) => expect(group).toHaveTextContent(lines[index] ?? ""));
    expect(
      within(groups[0] as HTMLElement).getByRole("button", { name: "Traces →" }),
    ).toBeVisible();
  });

  it("shows the within-bounds line for a read with no row and no group", () => {
    renderOutOfBounds(QUIET_READ);

    expect(
      screen.getByText("✓ 6 stages, 8 tiles and causes within bounds · Oct 24 – Oct 30"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ended in range/ })).toBeNull();
  });
});
