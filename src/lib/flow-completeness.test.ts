import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import { awaitingOf, completenessOf, dataSignalOf } from "./flow-completeness";
import { evaluate, frameOf, isActive } from "./flow-status";

const FLOW_READ = flowRead as unknown as FlowRead;

function readWith(completeness: Partial<FlowRead["completeness"]>): FlowRead {
  return { ...FLOW_READ, completeness: { ...FLOW_READ.completeness, ...completeness } };
}

describe("completenessOf", () => {
  it("answers 98.4 % for the fixture", () => {
    expect(awaitingOf(FLOW_READ)).toBe(9);
    expect(completenessOf(FLOW_READ)).toBeCloseTo(0.984, 3);
  });

  it("answers 1 for an empty read", () => {
    const empty = readWith({
      executions: 0,
      open: 0,
      no_root: 0,
      exit_unknown: 0,
      awaiting_ingestion: [],
    });

    expect(completenessOf(empty)).toBe(1);
  });

  it("answers 1 when every execution is open and none has no root", () => {
    expect(completenessOf(readWith({ executions: 4, open: 4, no_root: 0 }))).toBe(1);
  });
});

describe("dataSignalOf", () => {
  const frame = frameOf(FLOW_READ, "7d");

  it("reads data.awaiting with the value 9 and the slice claude-code@1", () => {
    const signal = dataSignalOf(FLOW_READ, frame);

    expect(signal).toMatchObject({
      id: "data.awaiting",
      where: "data",
      metric: "awaiting ingestion",
      window: 9,
      series: null,
      slices: [{ key: "claude-code@1", window: 9, series: null }],
    });
    expect(isActive(evaluate(signal, frame))).toBe(true);
    expect(evaluate(signal, frame).slice).toEqual([]);
  });

  it("lists only the workers with a count above 0", () => {
    const read = readWith({
      awaiting_ingestion: [
        { worker_name: "a@1", count: 0 },
        { worker_name: "b@1", count: 3 },
      ],
    });

    expect(dataSignalOf(read, frame).slices.map((slice) => slice.key)).toEqual(["b@1"]);
  });

  it("reads data.completeness with awaiting at 0 and a completeness of 97 %", () => {
    const read = readWith({
      executions: 1000,
      open: 0,
      no_root: 0,
      exit_unknown: 30,
      awaiting_ingestion: [],
    });
    const signal = dataSignalOf(read, frame);

    expect(signal).toMatchObject({ id: "data.completeness", metric: "completeness", slices: [] });
    expect(signal.window).toBeCloseTo(0.97, 5);
    expect(evaluate(signal, frame)).toMatchObject({ state: "range", severity: "warn" });
  });

  it("stays ok for a completeness above 98 % with nothing awaiting", () => {
    const read = readWith({ awaiting_ingestion: [], exit_unknown: 0, no_root: 0 });

    expect(evaluate(dataSignalOf(read, frame), frame).state).toBe("ok");
  });

  it("drills to the traces of the window", () => {
    expect(dataSignalOf(FLOW_READ, frame).target).toBe(
      "/traces?state=ok&from=1792800000000&to=1793369520000",
    );
  });
});
