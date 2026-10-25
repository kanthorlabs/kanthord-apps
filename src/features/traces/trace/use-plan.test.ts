import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/mission", () => ({
  listNodeAttempts: vi.fn(),
  readNodeRevision: vi.fn(),
}));

import { ApiError } from "@/api/errors";
import { listNodeAttempts, readNodeRevision } from "@/api/resources/mission";
import type {
  MissionAttempt,
  MissionRevision,
  SpanAttributeValue,
  TraceSpan,
  TraceSummary,
} from "@/api/types";

import { useNodeRevision } from "./use-node-revision";
import { usePlan } from "./use-plan";

const SUMMARY = {
  trace_id: "trace-1",
  project_id: "project_1",
  node_id: "node_1",
  attempt: 2,
} as TraceSummary;

const ATTEMPTS = [
  { node_id: "node_1", attempt: 1, node_revision: 1 },
  { node_id: "node_1", attempt: 2, node_revision: 3 },
] as MissionAttempt[];

const REVISION = {
  node_id: "node_1",
  revision: 3,
  content: {
    name: "Ship it",
    requirement: "Build the thing",
    criterion: "The thing works",
    verifications: ["pnpm test"],
  },
  tasks: [
    { id: "task_a", filename: "a.md", content: { name: "Write code" } },
    { id: "task_b", filename: "b.md", content: { name: "Run tests" } },
    { id: "task_c", filename: "c.md", content: { name: "Publish" } },
  ],
} as unknown as MissionRevision;

function taskSpan(
  id: string,
  taskId: string,
  attributes: Readonly<Record<string, SpanAttributeValue>> = {},
  status: TraceSpan["status"] = "Ok",
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: id,
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation: "worker.task",
    start_time: 1000,
    end_time: 2000,
    status,
    attributes: { "kanthord.task.id": taskId, ...attributes },
    events: [],
    links: [],
    text_ids: [],
    created_at: 1000,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("usePlan", () => {
  it("reads the revision of the trace attempt", async () => {
    vi.mocked(listNodeAttempts).mockResolvedValue(ATTEMPTS);
    vi.mocked(readNodeRevision).mockResolvedValue(REVISION);
    const { result } = renderHook(() => usePlan(SUMMARY, []));
    await waitFor(() => expect(result.current.plan).not.toBeNull());
    expect(readNodeRevision).toHaveBeenCalledWith("node_1", 3);
    expect(result.current.plan).toMatchObject({
      name: "Ship it",
      revision: 3,
      requirement: "Build the thing",
      criterion: "The thing works",
      verifications: ["pnpm test"],
    });
  });

  it("derives the task states from the spans", async () => {
    vi.mocked(listNodeAttempts).mockResolvedValue(ATTEMPTS);
    vi.mocked(readNodeRevision).mockResolvedValue(REVISION);
    const spans = [
      taskSpan("s1", "task_a", { "kanthord.task.result": "complete" }),
      taskSpan("s2", "task_b", {}, "Error"),
    ];
    const { result } = renderHook(() => usePlan(SUMMARY, spans));
    await waitFor(() => expect(result.current.plan).not.toBeNull());
    expect(result.current.plan?.tasks).toEqual([
      { id: "task_a", name: "Write code", state: "done" },
      { id: "task_b", name: "Run tests", state: "failed" },
      { id: "task_c", name: "Publish", state: "open" },
    ]);
  });

  it("reads nothing for a trace with no node", () => {
    const { result } = renderHook(() => usePlan({ ...SUMMARY, node_id: null }, []));
    expect(listNodeAttempts).not.toHaveBeenCalled();
    expect(result.current.plan).toBeNull();
  });

  it("answers the error of a failed read", async () => {
    vi.mocked(listNodeAttempts).mockResolvedValue(ATTEMPTS);
    vi.mocked(readNodeRevision).mockRejectedValue(new ApiError("not_found", "Gone.", 404));
    const { result } = renderHook(() => usePlan(SUMMARY, []));
    await waitFor(() => expect(result.current.error?.message).toBe("Gone."));
    expect(result.current.plan).toBeNull();
  });
});

describe("useNodeRevision", () => {
  it("maps each task id to its name", async () => {
    vi.mocked(listNodeAttempts).mockResolvedValue(ATTEMPTS);
    vi.mocked(readNodeRevision).mockResolvedValue(REVISION);
    const { result } = renderHook(() => useNodeRevision(SUMMARY));
    await waitFor(() => expect(result.current.revision).toBe(REVISION));
    expect(result.current.taskNames.get("task_b")).toBe("Run tests");
    expect(result.current.taskNames.size).toBe(3);
  });

  it("reads nothing for a trace with no attempt", () => {
    const { result } = renderHook(() => useNodeRevision({ ...SUMMARY, attempt: null }));
    expect(listNodeAttempts).not.toHaveBeenCalled();
    expect(result.current.revision).toBeNull();
    expect(result.current.taskNames.size).toBe(0);
  });
});
