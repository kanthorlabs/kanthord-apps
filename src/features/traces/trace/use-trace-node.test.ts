import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/mission", () => ({
  listNodeAttempts: vi.fn(),
  readNodeRevision: vi.fn(),
}));
vi.mock("@/api/resources/tracking", () => ({
  listTracePage: vi.fn(),
}));

import { ApiError } from "@/api/errors";
import { listNodeAttempts, readNodeRevision } from "@/api/resources/mission";
import { listTracePage } from "@/api/resources/tracking";
import type { MissionAttempt, MissionRevision, TraceListItem, TraceSummary } from "@/api/types";

import { useTraceNode } from "./use-trace-node";

const SUMMARY = {
  trace_id: "trace-1",
  project_id: "project_1",
  node_id: "node_1",
  attempt: 2,
} as TraceSummary;

const ITEMS = [{ trace_id: "trace-1" }] as TraceListItem[];

const ATTEMPTS = [
  { node_id: "node_1", attempt: 1, node_revision: 1 },
  { node_id: "node_1", attempt: 2, node_revision: 3 },
] as MissionAttempt[];

const REVISION = {
  node_id: "node_1",
  revision: 3,
  content: { name: "Ship it" },
  tasks: [
    { id: "task_a", filename: "a.md", content: { name: "Write code" } },
    { id: "task_b", filename: "b.md", content: { name: "Run tests" } },
    { id: "task_c", filename: "c.md", content: { name: "Publish" } },
  ],
} as unknown as MissionRevision;

function readsNode(revision: MissionRevision = REVISION) {
  vi.mocked(listTracePage).mockResolvedValue({ items: ITEMS, next_cursor: null });
  vi.mocked(listNodeAttempts).mockResolvedValue(ATTEMPTS);
  vi.mocked(readNodeRevision).mockResolvedValue(revision);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("useTraceNode", () => {
  it("reads each resource once for one summary", async () => {
    readsNode();
    const { result } = renderHook(() => useTraceNode(SUMMARY));
    await waitFor(() => expect(result.current.revision).toBe(REVISION));

    expect(listTracePage).toHaveBeenCalledTimes(1);
    expect(listTracePage).toHaveBeenCalledWith({ node_id: "node_1" }, null, 100);
    expect(listNodeAttempts).toHaveBeenCalledTimes(1);
    expect(listNodeAttempts).toHaveBeenCalledWith("node_1");
    expect(readNodeRevision).toHaveBeenCalledTimes(1);
    expect(readNodeRevision).toHaveBeenCalledWith("node_1", 3);
    expect(result.current.items).toBe(ITEMS);
    expect(result.current.attempts).toBe(ATTEMPTS);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.revisionError).toBeNull();
  });

  it("maps each task id to its name", async () => {
    readsNode();
    const { result } = renderHook(() => useTraceNode(SUMMARY));
    await waitFor(() => expect(result.current.revision).toBe(REVISION));
    expect(result.current.taskNames.get("task_b")).toBe("Run tests");
    expect(result.current.taskNames.has("node_1")).toBe(false);
    expect([...result.current.taskNames.keys()]).toEqual(["task_a", "task_b", "task_c"]);
  });

  it("maps the node id to the node name for a revision with no task", async () => {
    const taskless = { ...REVISION, tasks: [] } as unknown as MissionRevision;
    readsNode(taskless);
    const { result } = renderHook(() => useTraceNode(SUMMARY));
    await waitFor(() => expect(result.current.revision).toBe(taskless));
    expect([...result.current.taskNames]).toEqual([["node_1", "Ship it"]]);
  });

  it("answers no revision for an attempt with no match", async () => {
    readsNode();
    const { result } = renderHook(() => useTraceNode({ ...SUMMARY, attempt: 9 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.revision).toBeNull();
    expect(result.current.taskNames.size).toBe(0);
    expect(readNodeRevision).not.toHaveBeenCalled();
  });

  it("reads no revision for a trace with no attempt", async () => {
    readsNode();
    const { result } = renderHook(() => useTraceNode({ ...SUMMARY, attempt: null }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.revision).toBeNull();
    expect(readNodeRevision).not.toHaveBeenCalled();
  });

  it("reads nothing for no summary and for a trace with no node", async () => {
    const { result, rerender } = renderHook(({ summary }) => useTraceNode(summary), {
      initialProps: { summary: null as TraceSummary | null },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ summary: { ...SUMMARY, node_id: null } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.attempts).toEqual([]);
    expect(listTracePage).not.toHaveBeenCalled();
    expect(listNodeAttempts).not.toHaveBeenCalled();
    expect(readNodeRevision).not.toHaveBeenCalled();
  });

  it("answers the error of a failed revision read", async () => {
    readsNode();
    vi.mocked(readNodeRevision).mockRejectedValue(new ApiError("not_found", "Gone.", 404));
    const { result } = renderHook(() => useTraceNode(SUMMARY));
    await waitFor(() => expect(result.current.revisionError?.message).toBe("Gone."));
    expect(result.current.revision).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("answers the error of a failed attempts read as both errors and retries it", async () => {
    readsNode();
    const failure = new ApiError("unavailable", "The daemon is down.", 503);
    vi.mocked(listNodeAttempts).mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useTraceNode(SUMMARY));
    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.revisionError).toBe(failure);

    result.current.retry();

    await waitFor(() => expect(result.current.revision).toBe(REVISION));
    expect(result.current.error).toBeNull();
    expect(result.current.revisionError).toBeNull();
  });
});
