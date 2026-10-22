import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as workersApi from "@/api/resources/workers";
import type { AgentDeclaration } from "@/api/types";

vi.mock("@/api/resources/workers");

import { useAgent } from "./use-agent";
import { useAgentChain } from "./use-agent-chain";

const COOLDOWN_END = Date.UTC(2026, 0, 1, 12, 0);

const RE: AgentDeclaration = {
  agent_name: "re@1",
  configuration_schema: { type: "object" },
  overridable_fields: [],
  enablement: null,
  prompt: { layers: [], final: "" },
  tools: [],
  chain: [
    {
      position: 0,
      level: "enablement",
      agent_provider: "router",
      provider: "openrouter",
      credential: "router-main",
      model_identifier: "qwen/qwen3-coder",
      reasoning_effort: "off",
      cooldown: { strikes: 1, available_at: COOLDOWN_END },
    },
  ],
  active_position: null,
  cooling: null,
};

function useAgentRows(agentName: string) {
  const agent = useAgent(agentName);
  const rows = useAgentChain(agent.data?.agent.chain ?? [], null, agent.data?.readAt ?? 0);
  return { agent, rows };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(COOLDOWN_END - 60_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAgentChain", () => {
  it("ends the cooldown of an entry at a reload after the cooldown ends", async () => {
    vi.mocked(workersApi.readAgent).mockImplementation(() => Promise.resolve({ ...RE }));
    const { result } = renderHook(() => useAgentRows("re@1"));
    await waitFor(() => expect(result.current.rows[0]?.cooldown).toBe("live"));

    vi.setSystemTime(COOLDOWN_END + 60_000);
    act(() => result.current.agent.reload());

    await waitFor(() => expect(workersApi.readAgent).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.rows[0]?.cooldown).toBe("expired"));
  });
});
