import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Page, Project, SchedulerExecutionRecord } from "@/api/types";

vi.mock("@/api/resources/scheduler", () => ({
  listProjectExecutionPage: vi.fn(),
}));

import { listProjectExecutionPage } from "@/api/resources/scheduler";

import { useDoneGroup, type DoneView } from "./use-done-group";
import type { DoneSource, RefreshSignal } from "./use-scheduler-board";

function record(id: string): SchedulerExecutionRecord {
  return {
    execution_id: id,
    project_id: "prj-1",
    node_id: "n_a",
    claimant: {
      worker_binding_id: "binding_1",
      resource_identity: "worker:kanthord:general-main",
      runtime_identity: "worker_instance_01",
      name: "general-main #1",
    },
    attempt: 1,
    pinned_revision: 1,
    node_branch: "kanthord/n_a",
    credentials: [],
    agent_selections: [],
    claim_state: "finished",
    expired_at: 3,
    created_at: 1,
    ended_at: 2,
    stop: null,
    trace_id: "0".repeat(31) + "1",
    root_span_id: "0".repeat(15) + "1",
  };
}

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const SOURCE: DoneSource = {
  project: PROJECT,
  nodeNames: new Map([["n_a", "Add recovery codes"]]),
};

const FIRST: Page<SchedulerExecutionRecord> = { items: [record("e_one")], next_cursor: "c-1" };
const SECOND: Page<SchedulerExecutionRecord> = { items: [record("e_two")], next_cursor: null };

function signalOf(at: number, manual = 0): RefreshSignal {
  return { at, manual };
}

function idsOf(views: readonly DoneView[]): string[] {
  return views.map((view) => view.execution.execution_id);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useDoneGroup", () => {
  it("keeps a pending Next move when a refresh arrives", async () => {
    let finish: (page: Page<SchedulerExecutionRecord>) => void = () => undefined;
    vi.mocked(listProjectExecutionPage).mockImplementation((_projectId, cursor) =>
      cursor === "c-1"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(FIRST),
    );
    const view = renderHook(({ signal }) => useDoneGroup(SOURCE, false, signal), {
      initialProps: { signal: signalOf(1) },
    });
    await waitFor(() => expect(view.result.current.pages.status).toBe("ready"));

    act(() => view.result.current.pages.next());
    view.rerender({ signal: signalOf(2) });
    await act(async () => {
      finish(SECOND);
    });

    await waitFor(() => expect(idsOf(view.result.current.views)).toEqual(["e_two"]));
    expect(listProjectExecutionPage).toHaveBeenCalledTimes(2);
  });

  it("reloads the first page when a refresh arrives", async () => {
    vi.mocked(listProjectExecutionPage).mockResolvedValue(FIRST);
    const view = renderHook(({ signal }) => useDoneGroup(SOURCE, false, signal), {
      initialProps: { signal: signalOf(1) },
    });
    await waitFor(() => expect(view.result.current.pages.status).toBe("ready"));

    view.rerender({ signal: signalOf(2) });

    await waitFor(() => expect(listProjectExecutionPage).toHaveBeenCalledTimes(2));
    expect(listProjectExecutionPage).toHaveBeenLastCalledWith("prj-1", null, 20);
  });

  it("reloads only the first page when the cycle refreshes", async () => {
    vi.mocked(listProjectExecutionPage).mockImplementation(async (_projectId, cursor) =>
      cursor === "c-1" ? SECOND : FIRST,
    );
    const view = renderHook(({ signal }) => useDoneGroup(SOURCE, false, signal), {
      initialProps: { signal: signalOf(1) },
    });
    await waitFor(() => expect(view.result.current.pages.status).toBe("ready"));
    act(() => view.result.current.pages.next());
    await waitFor(() => expect(idsOf(view.result.current.views)).toEqual(["e_two"]));

    view.rerender({ signal: signalOf(2) });

    await act(async () => undefined);
    expect(listProjectExecutionPage).toHaveBeenCalledTimes(2);
  });

  it("reloads the current page when a manual refresh completes", async () => {
    vi.mocked(listProjectExecutionPage).mockImplementation(async (_projectId, cursor) =>
      cursor === "c-1" ? SECOND : FIRST,
    );
    const view = renderHook(({ signal }) => useDoneGroup(SOURCE, false, signal), {
      initialProps: { signal: signalOf(1) },
    });
    await waitFor(() => expect(view.result.current.pages.status).toBe("ready"));
    act(() => view.result.current.pages.next());
    await waitFor(() => expect(idsOf(view.result.current.views)).toEqual(["e_two"]));

    view.rerender({ signal: signalOf(1, 1) });
    view.rerender({ signal: signalOf(2, 1) });

    await waitFor(() => expect(listProjectExecutionPage).toHaveBeenCalledTimes(3));
    expect(listProjectExecutionPage).toHaveBeenLastCalledWith("prj-1", "c-1", 20);
    expect(idsOf(view.result.current.views)).toEqual(["e_two"]);
  });

  it("builds the node name, the link and the project name of a view", async () => {
    vi.mocked(listProjectExecutionPage).mockResolvedValue({
      items: [record("e_one"), { ...record("e_two"), node_id: "n_retired" }],
      next_cursor: null,
    });
    const view = renderHook(() => useDoneGroup(SOURCE, true, signalOf(1)));
    await waitFor(() => expect(view.result.current.pages.status).toBe("ready"));

    expect(view.result.current.views.map(({ execution: _, ...rest }) => rest)).toEqual([
      {
        nodeName: "Add recovery codes",
        projectName: "kanthord",
        href: "/projects/prj-1?node=n_a",
      },
      { nodeName: "n_retired", projectName: "kanthord", href: "/projects/prj-1?node=n_retired" },
    ]);
  });

  it("leaves the project name out when one project shows", async () => {
    vi.mocked(listProjectExecutionPage).mockResolvedValue(FIRST);
    const view = renderHook(() => useDoneGroup(SOURCE, false, signalOf(1)));
    await waitFor(() => expect(view.result.current.pages.status).toBe("ready"));

    expect(view.result.current.views[0]?.projectName).toBeNull();
  });
});
