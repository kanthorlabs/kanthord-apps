import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import type { Resource } from "@/hooks/use-resource";
import { emptyDraft, withWorker, type WorkerDraft } from "@/lib/binding-draft";
import type { BindingDraftState } from "./use-binding-draft";
import type { WorkerAgents } from "./use-worker-agents";
import { usePlacementDefault } from "./use-placement-default";

const PICKED: WorkerDraft = withWorker(emptyDraft("worker") as WorkerDraft, "coder@1");

function formOf(draft: WorkerDraft, creating: boolean): BindingDraftState {
  return {
    draft,
    errors: {},
    creating,
    edit: vi.fn(),
    validate: () => null,
    checkReady: false,
    saveReady: true,
    missingHint: null,
  };
}

function agentsOf(
  data: WorkerAgents | null,
  error: ApiError | null = null,
): Resource<WorkerAgents> {
  return { data, error, loading: data === null && error === null, reload: () => undefined };
}

describe("usePlacementDefault", () => {
  it("waits while the agents of a new binding load", () => {
    const form = formOf(PICKED, true);
    const { result } = renderHook(() => usePlacementDefault(form, agentsOf(null)));

    expect(result.current).toEqual({
      waiting: true,
      reason: "Save waits for the agents of the worker.",
    });
    expect(form.edit).not.toHaveBeenCalled();
  });

  it("keeps waiting and asks for a retry after a failed agent read", () => {
    const form = formOf(PICKED, true);
    const failure = new ApiError("unavailable", "The catalog does not answer.", 502);
    const { result } = renderHook(() => usePlacementDefault(form, agentsOf(null, failure)));

    expect(result.current).toEqual({ waiting: true, reason: "Retry the agent list to save." });
  });

  it("leaves the instance count of a hosted worker empty after the agents load", () => {
    const form = formOf(PICKED, true);
    const { result } = renderHook(() =>
      usePlacementDefault(form, agentsOf({ external: false, agents: [] })),
    );

    expect(result.current.waiting).toBe(false);
    expect(form.edit).not.toHaveBeenCalled();
  });

  it("sets an instance count of 1 for an external harness worker", () => {
    const form = formOf(PICKED, true);
    renderHook(() => usePlacementDefault(form, agentsOf({ external: true, agents: [] })));

    expect(form.edit).toHaveBeenCalledWith({ ...PICKED, instanceCount: "1" });
  });

  it("neither waits nor edits a saved binding", () => {
    const form = formOf(PICKED, false);
    const { result } = renderHook(() => usePlacementDefault(form, agentsOf(null)));

    expect(result.current.waiting).toBe(false);
    expect(form.edit).not.toHaveBeenCalled();
  });
});
