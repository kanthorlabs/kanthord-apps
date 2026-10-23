import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as projectsApi from "@/api/resources/projects";
import type { EnvironmentState, EnvironmentStatus } from "@/api/types";

vi.mock("@/api/resources/projects");

import { useProjectEnvironments } from "./use-project-environments";

function state(status: EnvironmentStatus): EnvironmentState {
  return {
    binding_id: "binding_1",
    binding_name: "engine",
    resource_identity: "resource_1",
    target: "image",
    source: "repository",
    status,
    digest: null,
    tag: null,
    run_started_at: 1_000,
    step_started_at: 1_000,
    reason: null,
    failure: null,
    checks: [],
    repairs: 0,
    repairing: false,
  };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useProjectEnvironments", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the states of the project and answers them", async () => {
    vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([state("ready")]);

    const { result } = renderHook(() => useProjectEnvironments("project_1"));
    await advance(0);

    expect(projectsApi.listProjectEnvironments).toHaveBeenCalledWith("project_1");
    expect(result.current.states?.[0]?.status).toBe("ready");
  });

  it("reads every 5 seconds while a state builds", async () => {
    vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([state("building")]);

    renderHook(() => useProjectEnvironments("project_1"));
    await advance(0);
    const readsAfterFirst = vi.mocked(projectsApi.listProjectEnvironments).mock.calls.length;
    await advance(5_000);

    expect(vi.mocked(projectsApi.listProjectEnvironments).mock.calls.length).toBe(
      readsAfterFirst + 1,
    );
  });

  it("reads every 30 seconds while every state is ready", async () => {
    vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([state("ready")]);

    renderHook(() => useProjectEnvironments("project_1"));
    await advance(0);
    const readsAfterFirst = vi.mocked(projectsApi.listProjectEnvironments).mock.calls.length;
    await advance(29_999);
    expect(vi.mocked(projectsApi.listProjectEnvironments).mock.calls.length).toBe(readsAfterFirst);
    await advance(1);

    expect(vi.mocked(projectsApi.listProjectEnvironments).mock.calls.length).toBe(
      readsAfterFirst + 1,
    );
  });
});
