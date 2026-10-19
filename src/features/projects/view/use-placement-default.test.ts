import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

function agentsOf(data: WorkerAgents | null): Resource<WorkerAgents> {
  return { data, error: null, loading: data === null, reload: () => undefined };
}

describe("usePlacementDefault", () => {
  it("waits and writes no placement while the agents of a new binding load", () => {
    const form = formOf(PICKED, true);
    const { result } = renderHook(() => usePlacementDefault(form, agentsOf(null)));

    expect(result.current.waiting).toBe(true);
    expect(form.edit).not.toHaveBeenCalled();
  });

  it("sets server for a new binding of a hosted worker after the agents load", () => {
    const form = formOf(PICKED, true);
    const { result } = renderHook(() =>
      usePlacementDefault(form, agentsOf({ external: false, agents: [] })),
    );

    expect(result.current.waiting).toBe(false);
    expect(form.edit).toHaveBeenCalledWith({ ...PICKED, placement: "server" });
  });

  it("leaves the placement of an external harness worker empty", () => {
    const form = formOf(PICKED, true);
    renderHook(() => usePlacementDefault(form, agentsOf({ external: true, agents: [] })));

    expect(form.edit).not.toHaveBeenCalled();
  });

  it("neither waits nor sets a placement for a saved binding", () => {
    const form = formOf(PICKED, false);
    const { result } = renderHook(() => usePlacementDefault(form, agentsOf(null)));

    expect(result.current.waiting).toBe(false);
    expect(form.edit).not.toHaveBeenCalled();
  });
});
