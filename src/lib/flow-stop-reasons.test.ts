import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import { frameOf } from "./flow-status";
import { stopMatrixOf } from "./flow-stop-reasons";

const FLOW_READ = flowRead as unknown as FlowRead;
const FRAME = frameOf(FLOW_READ, "7d");

function readWith(stop_reasons: Partial<FlowRead["stop_reasons"]>): FlowRead {
  return { ...FLOW_READ, stop_reasons: { ...FLOW_READ.stop_reasons, ...stop_reasons } };
}

describe("stopMatrixOf", () => {
  const matrix = stopMatrixOf(FLOW_READ, FRAME);

  it("follows the order of the read without budget_end and puts it below the divider", () => {
    expect(matrix.rows.map((row) => row.name)).toEqual(
      FLOW_READ.stop_reasons.order.filter((reason) => reason !== "budget_end"),
    );
    expect(matrix.budget.name).toBe("budget_end");
  });

  it("sums the rows into All failures", () => {
    expect(matrix.all).toMatchObject({
      name: "All failures",
      bold: true,
      total: "97",
      previous: "58",
    });
    expect(matrix.all.cells.map((cell) => cell.count)).toEqual([9, 9, 9, 43, 9, 10, 8]);
    expect(matrix.all.doubled).toBe(false);
  });

  it("reads the heading and the summary", () => {
    expect(matrix.heading).toBe("Stop reasons");
    expect(matrix.summary).toBe("97 stopped · 23 budget ends");
  });

  it("marks provider_failed as more than doubled with 28 on Oct 27", () => {
    const row = matrix.rows.find((candidate) => candidate.name === "provider_failed");

    expect(row).toMatchObject({ total: "39", previous: "9", doubled: true });
    expect(row?.cells[3]).toMatchObject({
      count: 28,
      text: "28",
      label: "provider_failed Oct 27: 28",
      shade: "seq5",
      target: "/traces?q=provider_failed&from=1793059200000&to=1793145600000",
    });
  });

  it("shows a dot for a zero cell without a link", () => {
    const row = matrix.rows.find((candidate) => candidate.name === "judgement_invalid");

    expect(row?.cells[6]).toMatchObject({ count: 0, text: "·", shade: null, target: null });
  });

  it("links an All failures cell to the failed traces of its day", () => {
    expect(matrix.all.cells[0]?.target).toBe(
      "/traces?state=error&from=1792800000000&to=1792886400000",
    );
  });

  it("ends the span of the last cell at now", () => {
    expect(matrix.all.cells[6]?.target).toBe(
      "/traces?state=error&from=1793318400000&to=1793369520000",
    );
  });

  it("shades the counts by band", () => {
    const shades = [1, 2, 3, 5, 6, 10, 11, 20, 21].map(
      (count) =>
        stopMatrixOf(
          readWith({ rows: { ...FLOW_READ.stop_reasons.rows, lost: [count, 0, 0, 0, 0, 0, 0] } }),
          FRAME,
        ).rows.find((row) => row.name === "lost")?.cells[0]?.shade,
    );

    expect(shades).toEqual([
      "seq1",
      "seq1",
      "seq2",
      "seq2",
      "seq3",
      "seq3",
      "seq4",
      "seq4",
      "seq5",
    ]);
  });

  it("heads the columns with the day numbers and the partial last day", () => {
    expect(matrix.lead).toBe("Oct");
    expect(matrix.columns.map((column) => column.label)).toEqual([
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
      "30",
    ]);
    expect(matrix.columns.map((column) => column.partial)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it("names the month where it changes", () => {
    const day = 86_400_000;
    const end = Date.UTC(2026, 10, 2);
    const buckets = [end - 3 * day, end - 2 * day, end - day, end];
    const read = {
      ...FLOW_READ,
      window: { ...FLOW_READ.window, buckets, now: end + day, to: end + day },
    };

    expect(stopMatrixOf(read, frameOf(read, "7d")).columns.map((column) => column.label)).toEqual([
      "30",
      "31",
      "Nov 1",
      "2",
    ]);
  });

  it("confirms both sums against the exits of the stages", () => {
    expect(matrix.reconciliation).toBe(
      "Σ above the divider 97 = ↓ stopped exits ✓ · budget_end 23 = ↺ budget loops ✓",
    );
  });

  it("warns where a sum differs from the exits", () => {
    const read = readWith({
      rows: { ...FLOW_READ.stop_reasons.rows, lost: [5, 1, 0, 1, 0, 1, 1] },
    });

    expect(stopMatrixOf(read, FRAME).reconciliation).toBe(
      "Σ above the divider 102 = ↓ stopped exits ⚠ 102 ≠ 97 · budget_end 23 = ↺ budget loops ✓",
    );
  });

  it("reads a dash as previous total without previous totals", () => {
    const bare = stopMatrixOf(readWith({ previous_totals: null }), FRAME);

    expect(bare.all.previous).toBe("—");
    expect(bare.rows[0]?.previous).toBe("—");
    expect(bare.budget.previous).toBe("—");
    expect(bare.rows.some((row) => row.doubled)).toBe(false);
  });
});
