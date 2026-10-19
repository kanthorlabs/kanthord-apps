import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import * as workersApi from "@/api/resources/workers";
import type { WorkerCatalogEntry } from "@/api/types";
import { useWorkerAgents } from "./use-worker-agents";

vi.mock("@/api/resources/workers");

function entry(name: string, agentNames: readonly string[]): WorkerCatalogEntry {
  return {
    name,
    host: "kanthord",
    declared_node_states: ["Available"],
    declared_intents: ["implement", "examine"],
    method: "steps",
    agent_names: agentNames,
    resource_budget: { turns: 200, wall_time_ms: 7200000 },
  };
}

describe("useWorkerAgents", () => {
  it("shows no agent of the previous worker while the next worker loads", async () => {
    let finishSecond: (value: WorkerCatalogEntry) => void = () => {};
    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([]);
    vi.mocked(workersApi.readWorkerCatalogEntry).mockImplementation((name) =>
      name === "coder@1"
        ? Promise.resolve(entry("coder@1", ["swe@1"]))
        : new Promise((resolve) => {
            finishSecond = resolve;
          }),
    );
    const { result, rerender } = renderHook(({ worker }) => useWorkerAgents(worker), {
      initialProps: { worker: "coder@1" },
    });
    await waitFor(() => expect(result.current.data?.agents).toHaveLength(1));

    rerender({ worker: "reviewer@1" });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    finishSecond(entry("reviewer@1", ["re@1"]));
    await waitFor(() =>
      expect(result.current.data?.agents.map((agent) => agent.agentName)).toEqual(["re@1"]),
    );
  });
  it("reads the agent state again on reload after the human enables an agent", async () => {
    vi.mocked(workersApi.readWorkerCatalogEntry).mockResolvedValue(entry("reviewer@1", ["re@1"]));
    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([]);
    const { result } = renderHook(() => useWorkerAgents("reviewer@1"));
    await waitFor(() => expect(result.current.data?.agents[0]?.state).toBe("absent"));

    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([
      {
        agent_name: "re@1",
        state: "enabled",
        agent_providers: [{ name: "router", provider: "openrouter", credential: "router-main" }],
        default_configuration: {
          agent_provider: "router",
          model_identifier: "qwen/qwen3-coder",
          reasoning_effort: "medium",
        },
        fallback_configurations: [],
        revision: 1,
      },
    ]);
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.data?.agents[0]?.state).toBe("enabled"));
  });
});
