import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readAgentEnablement } from "@/api/resources/workers";
import type { AgentEnablement, AgentEnablementState } from "@/api/types";
import { useEnvAgentEnabled } from "./use-env-agent-enabled";

vi.mock("@/api/resources/workers", () => ({ readAgentEnablement: vi.fn() }));

function enablement(state: AgentEnablementState): AgentEnablement {
  return {
    agent_name: "env@1",
    state,
    agent_providers: [],
    default_configuration: {
      agent_provider: "router",
      model_identifier: "qwen/qwen3-coder",
      reasoning_effort: "medium",
    },
    fallback_configurations: [],
    revision: 1,
  };
}

beforeEach(() => {
  vi.mocked(readAgentEnablement).mockReset();
});

describe("useEnvAgentEnabled", () => {
  it("answers null while the read runs", () => {
    vi.mocked(readAgentEnablement).mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useEnvAgentEnabled());

    expect(result.current).toBeNull();
    expect(readAgentEnablement).toHaveBeenCalledWith("env@1");
  });

  it("answers true for the state enabled", async () => {
    vi.mocked(readAgentEnablement).mockResolvedValue(enablement("enabled"));

    const { result } = renderHook(() => useEnvAgentEnabled());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("answers false for the state disabled", async () => {
    vi.mocked(readAgentEnablement).mockResolvedValue(enablement("disabled"));

    const { result } = renderHook(() => useEnvAgentEnabled());

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("answers false for a 404 answer", async () => {
    vi.mocked(readAgentEnablement).mockRejectedValue(
      new ApiError("not_found", "No such enablement.", 404, "agent.enablement.not_found"),
    );

    const { result } = renderHook(() => useEnvAgentEnabled());

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("answers null after another failure", async () => {
    vi.mocked(readAgentEnablement).mockRejectedValue(
      new ApiError("unavailable", "The daemon is not reachable.", 0),
    );

    const { result } = renderHook(() => useEnvAgentEnabled());

    await act(async () => undefined);
    expect(result.current).toBeNull();
  });
});
