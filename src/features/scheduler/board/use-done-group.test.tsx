import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Page, SchedulerExecutionRecord } from "@/api/types";

vi.mock("@/api/resources/scheduler", () => ({
  listProjectExecutionPage: vi.fn(),
}));

import { listProjectExecutionPage } from "@/api/resources/scheduler";

import { useDoneGroup } from "./use-done-group";
import type { RefreshSignal } from "./use-scheduler-board";

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

const FIRST: Page<SchedulerExecutionRecord> = { items: [record("e_one")], next_cursor: "c-1" };
const SECOND: Page<SchedulerExecutionRecord> = { items: [record("e_two")], next_cursor: null };

function signalOf(at: number, manual = 0): RefreshSignal {
  return { at, manual };
}

function idsOf(items: readonly SchedulerExecutionRecord[]): string[] {
  return items.map((item) => item.execution_id);
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
    const view = renderHook(({ signal }) => useDoneGroup("prj-1", signal), {
      initialProps: { signal: signalOf(1) },
    });
    await waitFor(() => expect(view.result.current.pages.status).toBe("ready"));

    act(() => view.result.current.pages.next());
    view.rerender({ signal: signalOf(2) });
    await act(async () => {
      finish(SECOND);
    });

    await waitFor(() => expect(idsOf(view.result.current.executions)).toEqual(["e_two"]));
    expect(listProjectExecutionPage).toHaveBeenCalledTimes(2);
  });

  it("reloads the first page when a refresh arrives", async () => {
    vi.mocked(listProjectExecutionPage).mockResolvedValue(FIRST);
    const view = renderHook(({ signal }) => useDoneGroup("prj-1", signal), {
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
    const view = renderHook(({ signal }) => useDoneGroup("prj-1", signal), {
      initialProps: { signal: signalOf(1) },
    });
    await waitFor(() => expect(view.result.current.pages.status).toBe("ready"));
    act(() => view.result.current.pages.next());
    await waitFor(() => expect(idsOf(view.result.current.executions)).toEqual(["e_two"]));

    view.rerender({ signal: signalOf(2) });

    await act(async () => undefined);
    expect(listProjectExecutionPage).toHaveBeenCalledTimes(2);
  });

  it("reloads the current page when a manual refresh completes", async () => {
    vi.mocked(listProjectExecutionPage).mockImplementation(async (_projectId, cursor) =>
      cursor === "c-1" ? SECOND : FIRST,
    );
    const view = renderHook(({ signal }) => useDoneGroup("prj-1", signal), {
      initialProps: { signal: signalOf(1) },
    });
    await waitFor(() => expect(view.result.current.pages.status).toBe("ready"));
    act(() => view.result.current.pages.next());
    await waitFor(() => expect(idsOf(view.result.current.executions)).toEqual(["e_two"]));

    view.rerender({ signal: signalOf(1, 1) });
    view.rerender({ signal: signalOf(2, 1) });

    await waitFor(() => expect(listProjectExecutionPage).toHaveBeenCalledTimes(3));
    expect(listProjectExecutionPage).toHaveBeenLastCalledWith("prj-1", "c-1", 20);
    expect(idsOf(view.result.current.executions)).toEqual(["e_two"]);
  });
});
