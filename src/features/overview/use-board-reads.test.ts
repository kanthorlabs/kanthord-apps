import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { listNodeAssessments, listNodeEvidence } from "@/api/resources/mission";
import { listTracePage, listTraceSpans } from "@/api/resources/tracking";
import { readWorkbenchEvents } from "@/api/resources/workbench";
import type {
  MissionAssessment,
  MissionEvidence,
  MissionNodeRecord,
  Project,
  SchedulerExecutionRecord,
  TraceListItem,
  TraceSpan,
  WorkbenchSessionEvents,
} from "@/api/types";
import type { ToolApprovalItem } from "@/lib/approval-attention";
import type { AttentionItem } from "@/lib/attention";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/workbench");

import { BoardReadsProvider, useBoardReads, useBoardReadsContext } from "./use-board-reads";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function node(id: string, attempt: number): MissionNodeRecord {
  return {
    id,
    intent: "implement",
    attempt,
    state: "Pending",
    visible_revision: 1,
    depends_on: [],
  } as unknown as MissionNodeRecord;
}

const TEAM = node("node_1", 2);
const ALPHA = node("node_a", 4);

const NODE_BASE = {
  group: "decisions",
  project: PROJECT,
  subject: "Team",
  missionVersion: 1,
  node: TEAM,
  nodes: [TEAM, ALPHA],
  at: null,
} as const;

const APPROVAL: ToolApprovalItem = {
  id: "tool_approval:s1",
  group: "decisions",
  kind: "tool_approval",
  subject: "Create",
  at: 2,
  sessionId: "s1",
  toolCallId: "c1",
  agent: "swe@1",
  operationId: "project.create",
};

const BLOCKED = {
  ...NODE_BASE,
  id: "blocked:node_1",
  kind: "blocked",
  cause: "Criterion not met",
} as unknown as AttentionItem;

const DEPENDENCY = {
  ...NODE_BASE,
  id: "dependency_discarded:node_1",
  kind: "dependency_discarded",
  cause: "Discarded dependency",
  discarded: [{ id: "node_a", name: "Alpha" }],
} as unknown as AttentionItem;

const EXECUTION = { execution_id: "e1", trace_id: "trace_e1" } as SchedulerExecutionRecord;

function pausedItem(execution: SchedulerExecutionRecord | null): AttentionItem {
  return {
    ...NODE_BASE,
    id: "paused:node_1",
    kind: "paused",
    cause: null,
    pause: execution === null ? null : { cause: "failure-limit", execution, endedAt: 1 },
  } as unknown as AttentionItem;
}

const PROJECT_PAUSED = {
  id: "project_paused:prj-1",
  kind: "project_paused",
  group: "fixes",
  project: PROJECT,
} as unknown as AttentionItem;

function events(pending: boolean): WorkbenchSessionEvents {
  return {
    entries: [],
    version: 1,
    snapshot: {
      pending_approval: pending
        ? { tool_call_id: "c1", operation_id: "project.create", input: { name: "alpha" } }
        : null,
    },
  } as unknown as WorkbenchSessionEvents;
}

function assessment(
  id: string,
  kind: "human" | "execution",
  rationale: string,
  createdAt: number,
): MissionAssessment {
  return {
    id,
    rationale,
    created_at: createdAt,
    actor:
      kind === "human"
        ? { kind, account: "u", name: "Ulrich" }
        : { kind, execution_id: "e", client_id: null, name: "swe@1" },
  } as MissionAssessment;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(listTraceSpans).mockResolvedValue([]);
  vi.mocked(listNodeEvidence).mockResolvedValue([]);
  vi.mocked(listNodeAssessments).mockResolvedValue([]);
});

describe("useBoardReads for a tool approval", () => {
  it("reads the session events and answers the pending call", async () => {
    vi.mocked(readWorkbenchEvents).mockResolvedValue(events(true));

    const { result } = renderHook(() => useBoardReads(APPROVAL));

    expect(result.current.session).toBeNull();
    await waitFor(() => expect(result.current.session?.status).toBe("ready"));
    expect(readWorkbenchEvents).toHaveBeenCalledWith("s1", null, null);
    expect(result.current.session).toEqual({
      status: "ready",
      data: { tool_call_id: "c1", operation_id: "project.create", input: { name: "alpha" } },
    });
  });

  it("answers a null pending call when the call no longer waits", async () => {
    vi.mocked(readWorkbenchEvents).mockResolvedValue(events(false));

    const { result } = renderHook(() => useBoardReads(APPROVAL));

    await waitFor(() => expect(result.current.session).toEqual({ status: "ready", data: null }));
  });

  it("answers a failed read, and reads again on retry", async () => {
    vi.mocked(readWorkbenchEvents)
      .mockRejectedValueOnce(new ApiError("unavailable", "The daemon is down.", 503))
      .mockResolvedValue(events(true));

    const { result } = renderHook(() => useBoardReads(APPROVAL));

    await waitFor(() =>
      expect(result.current.session).toEqual({ status: "failed", message: "The daemon is down." }),
    );
    act(() => result.current.retry.session());
    await waitFor(() => expect(result.current.session?.status).toBe("ready"));
    expect(readWorkbenchEvents).toHaveBeenCalledTimes(2);
  });

  it("makes no other read", async () => {
    vi.mocked(readWorkbenchEvents).mockResolvedValue(events(true));

    renderHook(() => useBoardReads(APPROVAL));

    await waitFor(() => expect(readWorkbenchEvents).toHaveBeenCalled());
    expect(listNodeAssessments).not.toHaveBeenCalled();
    expect(listNodeEvidence).not.toHaveBeenCalled();
    expect(listTraceSpans).not.toHaveBeenCalled();
    expect(listTracePage).not.toHaveBeenCalled();
  });

  it("reads once for each item key", async () => {
    vi.mocked(readWorkbenchEvents).mockResolvedValue(events(true));

    const { result, rerender } = renderHook(() => useBoardReads({ ...APPROVAL }));
    await waitFor(() => expect(result.current.session?.status).toBe("ready"));
    rerender();
    rerender();

    expect(readWorkbenchEvents).toHaveBeenCalledTimes(1);
  });
});

describe("useBoardReads for a dependency item", () => {
  it("reads the assessments at the attempt of the discarded dependency", async () => {
    const { result } = renderHook(() => useBoardReads(DEPENDENCY));

    await waitFor(() => expect(result.current.discard?.status).toBe("ready"));
    expect(listNodeAssessments).toHaveBeenCalledWith("node_a", 4);
  });

  it("takes the rationale of the newest human assessment as the reason", async () => {
    vi.mocked(listNodeAssessments).mockResolvedValue([
      assessment("a1", "human", "Old reason.", 1),
      assessment("a3", "execution", "Not a human.", 9),
      assessment("a2", "human", "Replaced by Beta.", 5),
    ]);

    const { result } = renderHook(() => useBoardReads(DEPENDENCY));

    await waitFor(() =>
      expect(result.current.discard).toEqual({
        status: "ready",
        data: [{ id: "node_a", reason: "Replaced by Beta." }],
      }),
    );
  });

  it("answers a null reason without a human assessment", async () => {
    vi.mocked(listNodeAssessments).mockResolvedValue([assessment("a3", "execution", "x", 9)]);

    const { result } = renderHook(() => useBoardReads(DEPENDENCY));

    await waitFor(() =>
      expect(result.current.discard).toEqual({
        status: "ready",
        data: [{ id: "node_a", reason: null }],
      }),
    );
  });

  it("answers a failed read", async () => {
    vi.mocked(listNodeAssessments).mockRejectedValue(new ApiError("unavailable", "Down.", 503));

    const { result } = renderHook(() => useBoardReads(DEPENDENCY));

    await waitFor(() =>
      expect(result.current.discard).toEqual({ status: "failed", message: "Down." }),
    );
  });
});

describe("useBoardReads for a blocked item", () => {
  it("reads the evidence of the attempt", async () => {
    const record = { id: "ev1" } as MissionEvidence;
    vi.mocked(listNodeEvidence).mockResolvedValue([record]);

    const { result } = renderHook(() => useBoardReads(BLOCKED));

    await waitFor(() =>
      expect(result.current.evidence).toEqual({ status: "ready", data: [record] }),
    );
    expect(listNodeEvidence).toHaveBeenCalledWith("node_1", 2);
  });

  it("reads the newest trace cause of the node", async () => {
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        {
          trace_id: "trace_9",
          cause: { category: "model", assigner: "rule" },
        } as TraceListItem,
      ],
      next_cursor: null,
    });

    const { result } = renderHook(() => useBoardReads(BLOCKED));

    await waitFor(() =>
      expect(result.current.cause).toEqual({
        status: "ready",
        data: { traceId: "trace_9", cause: { category: "model", assigner: "rule" } },
      }),
    );
    expect(listTracePage).toHaveBeenCalledWith({ node_id: "node_1" }, null, 1);
  });

  it("answers a failed evidence read, and reads again on retry", async () => {
    vi.mocked(listNodeEvidence)
      .mockRejectedValueOnce(new ApiError("unavailable", "Down.", 503))
      .mockResolvedValue([]);

    const { result } = renderHook(() => useBoardReads(BLOCKED));

    await waitFor(() => expect(result.current.evidence?.status).toBe("failed"));
    act(() => result.current.retry.evidence());
    await waitFor(() => expect(result.current.evidence?.status).toBe("ready"));
  });
});

describe("useBoardReads for a paused item", () => {
  it("reads the spans of the newest execution and its trace cause", async () => {
    const span = { operation: "scheduler.transition" } as TraceSpan;
    vi.mocked(listTraceSpans).mockResolvedValue([span]);

    const { result } = renderHook(() => useBoardReads(pausedItem(EXECUTION)));

    await waitFor(() =>
      expect(result.current.transition).toEqual({ status: "ready", data: [span] }),
    );
    await waitFor(() => expect(result.current.cause?.status).toBe("ready"));
    expect(listTraceSpans).toHaveBeenCalledWith("trace_e1");
    expect(listTracePage).toHaveBeenCalledWith({ execution_id: "e1" }, null, 1);
  });

  it("makes no read without an execution", async () => {
    const { result } = renderHook(() => useBoardReads(pausedItem(null)));

    expect(result.current.transition).toEqual({ status: "ready", data: [] });
    expect(result.current.cause).toEqual({ status: "ready", data: null });
    expect(listTraceSpans).not.toHaveBeenCalled();
    expect(listTracePage).not.toHaveBeenCalled();
  });
});

describe("useBoardReads for a fix item", () => {
  it("makes no read", () => {
    const { result } = renderHook(() => useBoardReads(PROJECT_PAUSED));

    expect(result.current.cause).toEqual({ status: "ready", data: null });
    expect(listNodeEvidence).not.toHaveBeenCalled();
    expect(listTracePage).not.toHaveBeenCalled();
  });
});

describe("BoardReadsProvider", () => {
  function wrapperOf(item: AttentionItem, details = new Map()) {
    return ({ children }: { children: ReactNode }) =>
      createElement(BoardReadsProvider, { item, details, children });
  }

  it("holds the reads and the executions of the paused detail in its context", async () => {
    const paused = pausedItem(EXECUTION);
    const executions = [EXECUTION];
    const details = new Map([
      [
        "node_1",
        {
          kind: "paused",
          key: "node_1:2:Pending:1",
          executions: { status: "ready", data: executions },
          actions: { status: "ready", data: [] },
        },
      ],
    ]);

    const { result } = renderHook(() => useBoardReadsContext(), {
      wrapper: wrapperOf(paused, details),
    });

    expect(result.current.executions).toEqual(executions);
    await waitFor(() => expect(result.current.transition?.status).toBe("ready"));
  });

  it("holds no execution without a paused detail", () => {
    const { result } = renderHook(() => useBoardReadsContext(), { wrapper: wrapperOf(BLOCKED) });

    expect(result.current.executions).toEqual([]);
  });
});
