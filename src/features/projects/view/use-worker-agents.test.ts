import { renderHook, waitFor } from "@testing-library/react";
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
    required_node_format: ["name"],
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
      name === "developer@1"
        ? Promise.resolve(entry("developer@1", ["swe@1", "re@1"]))
        : new Promise((resolve) => {
            finishSecond = resolve;
          }),
    );
    const { result, rerender } = renderHook(({ worker }) => useWorkerAgents(worker), {
      initialProps: { worker: "developer@1" },
    });
    await waitFor(() => expect(result.current.data?.agents).toHaveLength(2));

    rerender({ worker: "reviewer@1" });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    finishSecond(entry("reviewer@1", ["re@1"]));
    await waitFor(() =>
      expect(result.current.data?.agents.map((agent) => agent.agentName)).toEqual(["re@1"]),
    );
  });
});
