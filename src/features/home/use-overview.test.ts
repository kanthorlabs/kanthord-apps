import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { listInboxItems } from "@/api/resources/mission";
import type { MissionNodeRecord, Project, WorkbenchSessionListItem } from "@/api/types";

import type { OverviewSnapshot, ProjectRead } from "./read-overview-snapshot";
import type { OverviewSnapshotResource } from "./use-overview-snapshot";

const refreshDetail = vi.hoisted(() => vi.fn());

vi.mock("@/api/resources/mission", () => ({ listInboxItems: vi.fn() }));
vi.mock("./use-overview-snapshot", () => ({ useOverviewSnapshot: vi.fn() }));
vi.mock("./use-overview-setup", () => ({
  useOverviewSetup: () => ({
    data: null,
    error: null,
    loading: false,
    updatedAt: 1,
    now: 10_000_000,
    refresh: () => undefined,
  }),
}));
vi.mock("./use-attention-details", () => ({
  useAttentionDetails: () => ({ details: new Map(), refresh: refreshDetail }),
}));

import { useOverviewSnapshot } from "./use-overview-snapshot";
import { useOverview } from "./use-overview";

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const BETA: Project = { ...ATLAS, id: "prj-2", name: "beta" };

const SESSION: WorkbenchSessionListItem = {
  id: "s1",
  agent_name: "swe@1",
  name: null,
  created: 1,
  modified: 2,
  message_count: 1,
  first_message: "Create",
  run_active: true,
  pending_approval: { tool_call_id: "c1", operation_id: "project.create" },
};

function blocked(id: string): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: `Node ${id}`,
      requirement: "",
      criterion: "",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    intent: "implement",
    tags: [],
    tasks: [],
    state: "Blocked",
    attempt: 2,
    priority: 0,
    depends_on: [],
  };
}

function readOf(project: Project, nodeId: string, jobs = 0): ProjectRead {
  return {
    project,
    mission: { id: `mission_${project.id}`, project_id: project.id, version: 1 },
    nodes: [blocked(nodeId)],
    jobs: Array.from({ length: jobs }, (_, index) => ({
      job_id: `job_${project.id}_${index}`,
      project_id: project.id,
      node_id: nodeId,
      priority: 0,
      queued_at: 1,
    })),
    registrations: [],
    executions: [],
    environments: [],
    findings: [],
    absent: [],
  };
}

const SNAPSHOT: OverviewSnapshot = {
  projects: [ATLAS, BETA],
  reads: [readOf(ATLAS, "a1", 2), readOf(BETA, "b1", 1)],
  sessions: [SESSION],
  faults: [],
  absent: [],
};

function render(entry: string, overrides: Partial<OverviewSnapshotResource> = {}) {
  const polled: OverviewSnapshotResource = {
    data: SNAPSHOT,
    error: null,
    loading: false,
    updatedAt: 1,
    now: 10_000_000,
    running: false,
    refresh: () => undefined,
    readWith: () => undefined,
    retry: () => undefined,
    ...overrides,
  };
  vi.mocked(useOverviewSnapshot).mockReturnValue(polled);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [entry] }, children);
  return renderHook(() => useOverview(), { wrapper });
}

function idsOf(items: readonly { readonly id: string }[]): readonly string[] {
  return items.map((item) => item.id).sort();
}

describe("useOverview board state", () => {
  it("derives the board items over every project", () => {
    const { boardItems, snapshots } = render("/").result.current;

    expect(idsOf(boardItems)).toEqual(["blocked:a1", "blocked:b1", "tool_approval:s1"]);
    expect(snapshots.map((entry) => entry.project.id)).toEqual(["prj-1", "prj-2"]);
  });

  it("reads every project and ignores a project query", () => {
    const state = render("/?project=prj-2").result.current;

    expect(idsOf(state.boardItems)).toEqual(["blocked:a1", "blocked:b1", "tool_approval:s1"]);
    expect(state.snapshots).toHaveLength(2);
    expect(state.waiting).toBe(3);
  });

  it("answers the held nodes of each board item", () => {
    const { held } = render("/").result.current;

    expect(held.get("blocked:a1")).toEqual(["a1"]);
    expect(held.get("tool_approval:s1")).toEqual([]);
  });
});

describe("useOverview inbox absence", () => {
  const ABSENT = new ApiError("not_found", "No route.", 404, "gateway.routing.not_found");

  it("lists an absent inbox in absent and gives no inbox fault", async () => {
    vi.mocked(listInboxItems).mockRejectedValue(ABSENT);

    const hook = render("/");

    await waitFor(() => expect(hook.result.current.inbox.ready).toBe(true), { timeout: 2000 });
    expect(hook.result.current.absent).toEqual(["inbox"]);
    expect(hook.result.current.faults.map((fault) => fault.source)).not.toContain("inbox");
  });

  it("keeps the inbox fault when the inbox answers 500", async () => {
    vi.mocked(listInboxItems).mockRejectedValue(
      new ApiError("malformed", "Broken.", 500, "gateway.internal"),
    );

    const hook = render("/");

    await waitFor(() => expect(hook.result.current.inbox.ready).toBe(true), { timeout: 2000 });
    expect(hook.result.current.absent).toEqual([]);
    expect(hook.result.current.faults.map((fault) => fault.source)).toContain("inbox");
  });
});

describe("useOverview retryFaults", () => {
  const QUEUE_FAULT = {
    projectId: "prj-1",
    projectName: "atlas",
    source: "queue",
    message: "No answer.",
  };

  it("runs the full read when the project list failed", () => {
    const refresh = vi.fn();
    const retry = vi.fn();
    const failure = new ApiError("unreachable", "No answer.", 0);

    const hook = render("/", {
      error: failure,
      refresh,
      retry,
      data: { ...SNAPSHOT, faults: [QUEUE_FAULT] },
    });
    act(() => hook.result.current.retryFaults());

    expect(hook.result.current.faults.map((fault) => fault.source)).toContain("project list");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it("reads the inbox again and not the snapshot when the inbox failed", async () => {
    vi.mocked(listInboxItems).mockReset();
    vi.mocked(listInboxItems).mockRejectedValue(
      new ApiError("malformed", "Broken.", 500, "gateway.internal"),
    );
    const refresh = vi.fn();
    const retry = vi.fn();
    const hook = render("/", { refresh, retry });
    await waitFor(
      () => expect(hook.result.current.faults.map((f) => f.source)).toEqual(["inbox"]),
      {
        timeout: 2000,
      },
    );
    const reads = vi.mocked(listInboxItems).mock.calls.length;
    vi.mocked(listInboxItems).mockResolvedValue({
      items: [],
      next_cursor: null,
      counts: { open: 0, snoozed: 0 },
    });

    act(() => hook.result.current.retryFaults());

    await waitFor(() => expect(hook.result.current.faults).toEqual([]), { timeout: 2000 });
    expect(vi.mocked(listInboxItems).mock.calls.length).toBeGreaterThan(reads);
    expect(refresh).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it("retries only the snapshot when a queue read failed", async () => {
    vi.mocked(listInboxItems).mockReset();
    vi.mocked(listInboxItems).mockResolvedValue({
      items: [],
      next_cursor: null,
      counts: { open: 0, snoozed: 0 },
    });
    refreshDetail.mockClear();
    const refresh = vi.fn();
    const retry = vi.fn();
    const hook = render("/", { refresh, retry, data: { ...SNAPSHOT, faults: [QUEUE_FAULT] } });
    await waitFor(() => expect(hook.result.current.inbox.ready).toBe(true), { timeout: 2000 });
    const reads = vi.mocked(listInboxItems).mock.calls.length;
    const { updatedAt } = hook.result.current;

    act(() => hook.result.current.retryFaults());

    expect(retry).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(refreshDetail).not.toHaveBeenCalled();
    expect(vi.mocked(listInboxItems).mock.calls.length).toBe(reads);
    expect(hook.result.current.updatedAt).toBe(updatedAt);
  });
});
