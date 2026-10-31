import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";
import type { FlowSplit } from "@/lib/flow-query";
import { frameOf } from "@/lib/flow-status";

import flowRead from "../../../../test/flow-read.json";
import { SplitTable } from "./split-table";

const FLOW_READ = flowRead as unknown as FlowRead;
const FRAME = frameOf(FLOW_READ, "7d");

function Probe() {
  const location = useLocation();
  return <p>{`at ${location.search}`}</p>;
}

function mount(split: FlowSplit = "model", entry = "/analytics?tab=cost") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SplitTable read={FLOW_READ} frame={FRAME} split={split} />
      <Probe />
    </MemoryRouter>,
  );
}

function rowOf(key: string): HTMLElement {
  return screen.getByRole("rowheader", { name: key }).closest("[role=row]") as HTMLElement;
}

function cellTexts(row: HTMLElement): readonly string[] {
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent ?? "");
}

describe("SplitTable", () => {
  it("renders one table in an overflow-x-auto box", () => {
    mount();

    const table = screen.getByRole("table", { name: "Cost by model" });
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(table.parentElement).toHaveClass("overflow-x-auto");
  });

  it("names the ten columns", () => {
    mount();

    expect(screen.getAllByRole("columnheader").map((head) => head.textContent)).toEqual([
      "Key",
      "Cost",
      "Share",
      "Δ cost",
      "Cost by day",
      "Cache hit",
      "$ / 1M",
      "In (cache) / out",
      "Turns",
      "Unpriced",
    ]);
  });

  it("lists the model rows by cost and then All", () => {
    mount();

    const keys = screen.getAllByRole("rowheader").map((head) => head.textContent);
    expect(keys).toEqual(["claude-sonnet-4-5", "gpt-5-codex", "qwen3-coder", "All"]);
  });

  it("reads the cells of a model row", () => {
    mount();

    const cells = cellTexts(rowOf("claude-sonnet-4-5"));
    expect(cells[0]).toBe("$236");
    expect(cells[1]).toBe("57 %");
    expect(cells[2]).toBe("+$29");
    expect(cells[4]).toBe("74.4 %");
    expect(cells[5]).toBe("$0.75");
  });

  it("reads the row All", () => {
    mount();

    const cells = cellTexts(rowOf("All"));
    expect(cells[0]).toBe("$413");
    expect(cells[1]).toBe("100 %");
    expect(cells[2]).toBe("+$63");
    expect(cells[4]).toBe("68.5 %");
    expect(cells[5]).toBe("$0.70");
    expect(cells[6]).toBe("645 M (442 M) / 9.5 M");
    expect(cells[7]).toBe("18,490");
    expect(cells[8]).toBe("61.9 M");
  });

  it("shows the bad cache hit status of the gpt-5-codex row", () => {
    mount();

    expect(
      within(rowOf("gpt-5-codex")).getByRole("img", { name: "gpt-5-codex cache hit status bad" }),
    ).toBeInTheDocument();
    expect(within(rowOf("qwen3-coder")).queryByLabelText(/cache hit status/)).toBeNull();
  });

  it("draws a cost by day and a cache hit line for each row", () => {
    mount();

    const row = rowOf("qwen3-coder");
    expect(
      within(row).getByRole("img", { name: /^Daily cost of qwen3-coder/ }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("img", {
        name: /^Daily qwen3-coder cache hit from .*warn line 60\.0 %/,
      }),
    ).toBeInTheDocument();
  });

  it("links the key of a row to the traces of the window", () => {
    mount();

    expect(screen.getByRole("link", { name: "gpt-5-codex" })).toHaveAttribute(
      "href",
      "/traces?model=gpt-5-codex&sort=cost_usd&from=1792800000000&to=1793369520000",
    );
    expect(screen.queryByRole("link", { name: "All" })).toBeNull();
  });

  it("reads an unpriced worker row", () => {
    mount("worker_name");

    const cells = cellTexts(rowOf("claude-code@1"));
    expect(cells.slice(0, 3)).toEqual(["unpriced", "—", "—"]);
    expect(cells[5]).toBe("—");
  });

  it("shows the stage rows and the note", () => {
    mount("stage");

    expect(screen.getByRole("table", { name: "Cost by stage" })).toBeInTheDocument();
    expect(cellTexts(rowOf("Release gate"))).toEqual(["$4.30", "67 %", "$3.40", "$271"]);
    expect(screen.getByText("Ended here + handed on = $413, the total cost.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Release gate" })).toBeNull();
  });

  it("marks the chosen split as pressed", () => {
    mount("worker_name");

    expect(screen.getByRole("button", { name: "Worker" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Model" })).toHaveAttribute("aria-pressed", "false");
  });

  it("writes the split to the address", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: "Stage" }));

    expect(screen.getByText("at ?tab=cost&split=stage")).toBeInTheDocument();
  });

  it("keeps the split when the pressed item is clicked again", async () => {
    const user = userEvent.setup();
    mount("model", "/analytics?tab=cost&split=model");

    await user.click(screen.getByRole("button", { name: "Model" }));

    expect(screen.getByText("at ?tab=cost&split=model")).toBeInTheDocument();
  });
});
