import { describe, expect, it } from "vitest";

import type { FlowRead, FlowStage, FlowStageResult } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import { type FlowColumn, type FlowModel, flowOf } from "./flow-stages";
import { frameOf } from "./flow-status";

const FLOW_READ = flowRead as unknown as FlowRead;
const SCOPE = { projectId: null, workerName: null };
const COLUMN_STAGES: readonly FlowStage[] = [
  "queued",
  "executing",
  "verification",
  "release_gate",
  "evaluation",
  "outcome",
];

function modelOf(read: FlowRead = FLOW_READ): FlowModel {
  return flowOf(read, frameOf(read, "7d"), SCOPE);
}

function columnOf(stage: FlowStage, read: FlowRead = FLOW_READ): FlowColumn {
  const column = modelOf(read).columns.find((candidate) => candidate.stage === stage);
  if (column === undefined) throw new Error(`No column ${stage}`);
  return column;
}

function withStage(
  read: FlowRead,
  stage: FlowStage,
  patch: (result: FlowStageResult) => FlowStageResult,
): FlowRead {
  return {
    ...read,
    stages: read.stages.map((result) => (result.stage === stage ? patch(result) : result)),
  };
}

function severitiesOf(stage: FlowStage, read: FlowRead = FLOW_READ): readonly string[] {
  return columnOf(stage, read).strip.cells.map((cell) => cell.severity);
}

function signalLinesOf(stage: FlowStage): readonly string[] {
  return columnOf(stage).bands.signals.lines.map((line) =>
    `${line.glyph ?? ""} ${line.text}`.trim(),
  );
}

describe("flowOf columns", () => {
  it("answers the six columns in order", () => {
    expect(modelOf().columns.map((column) => column.stage)).toEqual(COLUMN_STAGES);
    expect(modelOf().columns.map((column) => column.name)).toEqual([
      "Queued",
      "Executing",
      "Verification",
      "Release gate",
      "Evaluation",
      "Outcome",
    ]);
  });

  it("reads the headlines of the key signals", () => {
    const headlines = modelOf().columns.map(
      ({ headline }) => `${headline.label} ${headline.value}`,
    );
    expect(headlines).toEqual([
      "wait p90 10 min 7d",
      "leak rate 16.7 % 7d",
      "flaky runs 22.0 % Oct 29",
      "leak rate 2.0 % 7d",
      "review p90 2.7 h Oct 29",
      "rework 27.8 % 7d",
    ]);
  });

  it("takes the status color only for an active key result", () => {
    expect(modelOf().columns.map((column) => column.headline.severity)).toEqual([
      "ok",
      "ok",
      "bad",
      "ok",
      "warn",
      "ok",
    ]);
  });

  it("shows the bad icon on Verification and the warn icon on Evaluation", () => {
    expect(modelOf().columns.map((column) => column.icon)).toEqual([
      "ok",
      "ok",
      "bad",
      "ok",
      "warn",
      "ok",
    ]);
  });

  it("reads the exception slots", () => {
    const slots = modelOf().columns.map(({ exception }) =>
      exception === null ? null : [exception.text, exception.muted, exception.reader],
    );
    expect(slots).toEqual([
      null,
      ["◐ provider errors 118 · Oct 27", true, " ended"],
      ["◐ revision loops 0.81 · Oct 29", false, ""],
      null,
      ["◐ leak 20.0 % · Oct 27", true, " ended"],
      ["◐ blocked 5.3 % · Oct 28", true, " ended"],
    ]);
  });

  it("reads the exit summaries and the entered lines", () => {
    expect(modelOf().columns.map((column) => column.exits)).toEqual([
      "",
      "↓ 68 ↺ 9",
      "↓ 7 ↺ 17",
      "↓ 5 → 300",
      "↓ 25",
      "✓ 183 ↺ 74 ↓ 9",
    ]);
    expect(modelOf().columns.map((column) => column.entered)).toEqual([
      "412 in",
      "412 in",
      "281 in",
      "256 in",
      "296 in",
      "266 in",
    ]);
  });

  it("reads the loop line", () => {
    expect(modelOf().loops).toBe("↺ 100 loops re-enter Queued");
  });

  it("gives no loop line when no stage loops", () => {
    const quiet = {
      ...FLOW_READ,
      stages: FLOW_READ.stages.map((result) => ({
        ...result,
        current: { ...result.current, exits: {} },
      })),
    };
    expect(modelOf(quiet).loops).toBeNull();
  });

  it("gives an empty exception slot to a stage without a result above ok", () => {
    expect(columnOf("queued").exception).toBeNull();
    expect(columnOf("release_gate").exception).toBeNull();
  });
});

describe("flowOf day strips", () => {
  it("names the strip with the metric of the key signal", () => {
    expect(modelOf().columns.map((column) => column.strip.metric)).toEqual([
      "wait p90",
      "leak rate",
      "flaky runs",
      "leak rate",
      "review wait p90",
      "rework rate",
    ]);
  });

  it("marks Oct 27 bad and Oct 30 partial in Executing", () => {
    expect(severitiesOf("executing")).toEqual(["ok", "ok", "ok", "bad", "ok", "ok", "ok"]);
    const cells = columnOf("executing").strip.cells;
    expect(cells.map((cell) => cell.partial)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(cells[6]?.label).toBe(
      "Oct 30: leak rate 10.0 %, today, partial, changed by late records",
    );
  });

  it("marks Oct 28 and Oct 29 bad in Verification", () => {
    expect(severitiesOf("verification")).toEqual(["ok", "ok", "ok", "ok", "bad", "bad", "ok"]);
  });

  it("marks Oct 27 to Oct 29 warn in Evaluation", () => {
    expect(severitiesOf("evaluation")).toEqual(["ok", "ok", "ok", "warn", "warn", "warn", "ok"]);
  });

  it("marks Oct 24 to Oct 28 warn in Outcome", () => {
    expect(severitiesOf("outcome")).toEqual(["warn", "warn", "warn", "warn", "warn", "ok", "ok"]);
  });

  it("labels a cell with the day, the metric, the value and the status", () => {
    const cell = columnOf("executing").strip.cells[3];
    expect(cell?.label).toBe("Oct 27: leak rate 43.0 %, bad");
    expect(cell?.target).toBe("/traces?state=error&from=1793059200000&to=1793145600000");
  });

  it("adds the late records to the label of a changed bucket", () => {
    const cells = columnOf("executing").strip.cells;
    expect(cells[5]?.label).toBe("Oct 29: leak rate 11.5 %, within, changed by late records");
    expect(cells[5]?.changed).toBe(true);
    expect(cells[4]?.changed).toBe(false);
    expect(cells[4]?.label).toBe("Oct 28: leak rate 11.1 %, within");
  });

  it("reads under 5 settled for a leak cell with fewer settled executions", () => {
    const read = withStage(FLOW_READ, "executing", (result) => ({
      ...result,
      series: {
        ...result.series,
        entered: [6, ...result.series.entered.slice(1)],
        open: [3, 0, 0, 0, 0, 0, 4],
      },
    }));
    const cell = columnOf("executing", read).strip.cells[0];
    expect(cell?.underSettled).toBe(true);
    expect(cell?.severity).toBe("ok");
    expect(cell?.label).toBe("Oct 24: leak rate 9.1 %, under 5 settled");
  });

  it("reads under 5 settled only for the leak keys", () => {
    const read = withStage(FLOW_READ, "verification", (result) => ({
      ...result,
      series: { ...result.series, entered: [3, ...result.series.entered.slice(1)] },
    }));
    expect(columnOf("verification", read).strip.cells[0]?.underSettled).toBe(false);
  });

  it("opens the target of the stage for each cell", () => {
    expect(columnOf("verification").strip.cells[4]?.target).toBe(
      "/traces?from=1793145600000&to=1793232000000",
    );
    expect(columnOf("release_gate").strip.cells[0]?.target).toBe(
      "/traces?state=error&q=operation_failed&from=1792800000000&to=1792886400000",
    );
  });

  it("opens a partial cell until now", () => {
    expect(columnOf("executing").strip.cells[6]?.target).toBe(
      "/traces?state=error&from=1793318400000&to=1793369520000",
    );
  });
});

describe("flowOf bars", () => {
  it("shows forward, loops and leaks of Executing in grey", () => {
    expect(columnOf("executing").bar).toEqual([
      { kind: "forward", count: 331, severity: "ok" },
      { kind: "loops", count: 9, severity: "ok" },
      { kind: "leaks", count: 68, severity: "ok" },
    ]);
  });

  it("leaves a segment of 0 out", () => {
    expect(columnOf("queued").bar).toEqual([{ kind: "forward", count: 412, severity: "ok" }]);
    expect(columnOf("evaluation").bar.map((segment) => segment.kind)).toEqual(["forward", "leaks"]);
  });

  it("takes the status color on the leak segment of an active leak signal", () => {
    const read = withStage(FLOW_READ, "executing", (result) => ({
      ...result,
      series: {
        ...result.series,
        signals: {
          ...result.series.signals,
          leak_rate: [0.09, 0.12, 0.08, 0.43, 0.11, 0.3, 0.1],
        },
      },
    }));
    expect(columnOf("executing", read).bar).toEqual([
      { kind: "forward", count: 331, severity: "ok" },
      { kind: "loops", count: 9, severity: "ok" },
      { kind: "leaks", count: 68, severity: "bad" },
    ]);
  });

  it("takes the status color on the loop segment of an active rework signal", () => {
    const read = withStage(FLOW_READ, "outcome", (result) => ({
      ...result,
      series: {
        ...result.series,
        signals: {
          ...result.series.signals,
          rework_rate: [0.3, 0.3, 0.3, 0.3, 0.3, 0.45, 0.2],
        },
      },
    }));
    const kinds = columnOf("outcome", read).bar.map((segment) => [segment.kind, segment.severity]);
    expect(kinds).toEqual([
      ["forward", "ok"],
      ["loops", "bad"],
      ["leaks", "ok"],
    ]);
  });

  it("keeps the verification segments grey", () => {
    expect(columnOf("verification").bar.map((segment) => segment.severity)).toEqual([
      "ok",
      "ok",
      "ok",
    ]);
  });
});

describe("flowOf Details bands", () => {
  it("reads the exits band of each column", () => {
    const bands = modelOf().columns.map((column) => column.bands.exits);
    expect(bands.map((band) => band.header)).toEqual([
      "—",
      "pass 81.1 %",
      "pass 91.4 %",
      "pass 98.0 %",
      "pass 91.4 %",
      "success 68.8 %",
    ]);
    expect(bands[0]?.lines).toEqual([]);
    expect(bands[1]?.lines).toEqual([
      "↓ 64 stopped",
      "↓ 2 paused",
      "↓ 2 revoked",
      "↺ 6 budget",
      "↺ 3 further work",
    ]);
    expect(bands[3]?.lines).toEqual(["↓ 5 stopped", "→ 300 handed on"]);
    expect(bands[5]?.lines).toEqual([
      "✓ 171 completed",
      "✓ 12 external",
      "↓ 9 blocked",
      "↺ 74 rework → Queued",
    ]);
  });

  it("reads the time band of each column", () => {
    const bands = modelOf().columns.map((column) => column.bands.time);
    expect(bands.map((band) => [band.name, band.range, band.previous])).toEqual([
      ["wait", "2 min / 10 min", "prev p90 9 min"],
      ["exec", "24 min / 1.2 h", "prev p90 1.1 h"],
      ["run", "3 min / 9 min", "prev p90 8 min"],
      ["gate", "6 min / 17 min", "prev p90 16 min"],
      ["review wait", "18 min / 2.4 h", "prev p90 31 min"],
      ["lead", "5.6 h / 31 h", "prev p90 27 h"],
    ]);
  });

  it("adds the glyph and the status color to an active time signal", () => {
    const evaluation = columnOf("evaluation").bands.time;
    expect(evaluation.glyph).toBe("◐");
    expect(evaluation.severity).toBe("warn");
    const executing = columnOf("executing").bands.time;
    expect(executing.glyph).toBeNull();
    expect(executing.severity).toBe("ok");
  });

  it("reads a dash for a missing time", () => {
    const read = withStage(FLOW_READ, "queued", (result) => ({
      ...result,
      current: { ...result.current, time: null },
      previous: null,
    }));
    const band = columnOf("queued", read).bands.time;
    expect(band.range).toBe("— / —");
    expect(band.previous).toBe("prev p90 —");
  });

  it("reads one line for each non-time signal of Executing", () => {
    expect(signalLinesOf("executing")).toEqual([
      "■ leak rate 16.7 % (8.5 %) · ended Oct 27",
      "◐ provider errors (rate_limited) 133 (14) · ended Oct 27",
      "▢ provider errors (quota_exhausted) 9 (0)",
      "▢ provider errors (unavailable) 8 (0)",
      "▢ tool errors 4.7 % (4.4 %)",
    ]);
  });

  it("shows the window value that the headline of an ongoing signal does not show", () => {
    expect(signalLinesOf("verification")).toEqual([
      "■ flaky runs 12.2 % (4.6 %) · since Oct 28",
      "◐ revision loops 0.61 (0.49) · since Oct 29",
      "▢ affected fail 25.7 % (24.1 %)",
      "◐ base red 5.0 % (4.4 %) · ended Oct 25, Oct 27 – Oct 28",
    ]);
  });

  it("ends each signal line with the status for a screen reader", () => {
    const lines = columnOf("verification").bands.signals.lines;
    expect(lines.map((line) => line.reader)).toEqual(["bad", "warn", "within", "warn"]);
    expect(lines.map((line) => line.state)).toEqual(["ongoing", "ongoing", "ok", "ended"]);
  });

  it("gives a signal without a bound no glyph", () => {
    const read = withStage(FLOW_READ, "executing", (result) => ({
      ...result,
      previous_bucket_median: null,
    }));
    const line = columnOf("executing", read).bands.signals.lines[2];
    expect(line?.glyph).toBeNull();
    expect(line?.text).toBe("provider errors (quota_exhausted) 9 (0)");
  });

  it("reads the signal lines of the other columns", () => {
    expect(signalLinesOf("queued")).toEqual(["▢ wait p90 10 min (9 min)"]);
    expect(signalLinesOf("release_gate")).toEqual(["▢ leak rate 2.0 % (2.7 %)"]);
    expect(signalLinesOf("evaluation")).toEqual([
      "◐ leak rate 8.6 % (5.9 %) · ended Oct 27",
      "▢ evaluation time p90 19 min (18 min)",
    ]);
    expect(signalLinesOf("outcome")).toEqual([
      "◐ rework rate 27.8 % (19.3 %) · ended Oct 24 – Oct 28",
      "◐ blocked rate 3.4 % (2.6 %) · ended Oct 28",
    ]);
  });

  it("adds the context lines of each column", () => {
    expect(modelOf().columns.map((column) => column.bands.signals.context)).toEqual([
      ["wait p99 41 min (37 min)"],
      ["turns / execution 38.40", "other turn errors 5"],
      ["flaky tests 94 · routed runs 171"],
      ["verdicts: passed 231 · base_red 21 · absent 4"],
      ["decided at: judgement 38 · affected 16 · verification 12 · setup 3 · unrecorded 14"],
      ["blocked by rule: rework_limit 6 · plan_defect 3", "success 183 (176)"],
    ]);
  });

  it("counts unrecorded as rework plus blocked minus the evaluation counts", () => {
    expect(columnOf("evaluation").bands.signals.context[0]).toContain("unrecorded 14");
  });

  it("reads the Not in rates lines", () => {
    expect(modelOf().columns.map((column) => column.bands.notInRates)).toEqual([
      ["—"],
      ["○ 4 open"],
      ["○ 1 open", "50 passed with no telemetry (claude-code@1)"],
      ["○ 1 open", "50 passed with no telemetry (claude-code@1)"],
      ["○ 5 open"],
      ["—"],
    ]);
  });

  it("reads the no gate run line from unobserved_no_gate", () => {
    const read = withStage(FLOW_READ, "verification", (result) => ({
      ...result,
      current: {
        ...result.current,
        signals: { ...result.current.signals, unobserved_external: 0, unobserved_no_gate: 7 },
      },
      dimensions: result.dimensions.map((dimension) => ({
        ...dimension,
        signals: (dimension.key === "tdd@1" ? { unobserved_no_gate: 7 } : {}) as Record<
          string,
          number
        >,
      })),
    }));
    expect(columnOf("verification", read).bands.notInRates).toEqual([
      "○ 1 open",
      "7 passed with no gate run (tdd@1)",
    ]);
    expect(columnOf("release_gate", read).bands.notInRates).toEqual([
      "○ 1 open",
      "7 passed with no gate run (tdd@1)",
    ]);
  });
});

describe("flowOf legend", () => {
  const legendOf = (read: FlowRead = FLOW_READ) =>
    modelOf(read).legend.map((entry) => `${entry.glyph} ${entry.label}`);

  it("lists the present states and exits", () => {
    expect(legendOf()).toEqual([
      "▢ within",
      "◐ warn",
      "■ bad",
      "◔ today, partial",
      "↓ leak",
      "↺ loop",
      "→ handed on",
      "✓ success",
    ]);
  });

  it("leaves out the partial state when the last bucket is full", () => {
    const read = { ...FLOW_READ, window: { ...FLOW_READ.window, now: FLOW_READ.window.to } };
    expect(legendOf(read)).not.toContain("◔ today, partial");
  });

  it("lists the under settled state when a cell is under", () => {
    const read = withStage(FLOW_READ, "executing", (result) => ({
      ...result,
      series: {
        ...result.series,
        entered: [6, ...result.series.entered.slice(1)],
        open: [3, 0, 0, 0, 0, 0, 4],
      },
    }));
    expect(legendOf(read)).toContain("┄ under 5 settled");
  });

  it("leaves out an exit that no column shows", () => {
    const read = {
      ...FLOW_READ,
      stages: FLOW_READ.stages.map((result) => ({
        ...result,
        current: { ...result.current, exits: { ...result.current.exits, handed_on: undefined } },
      })),
    };
    expect(legendOf(read)).not.toContain("→ handed on");
  });
});
