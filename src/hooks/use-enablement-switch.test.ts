import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import {
  disableAgentEnablement,
  enableAgentEnablement,
  readAgentEnablement,
} from "@/api/resources/workers";
import type { AgentEnablement, AgentEnablementState } from "@/api/types";

import { useEnablementSwitch } from "./use-enablement-switch";

vi.mock("@/api/resources/workers", () => ({
  disableAgentEnablement: vi.fn(),
  enableAgentEnablement: vi.fn(),
  readAgentEnablement: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

function enablement(state: AgentEnablementState, revision: number): AgentEnablement {
  return {
    agent_name: "swe@1",
    state,
    agent_providers: [{ name: "router", provider: "openrouter", credential: "router-main" }],
    default_configuration: {
      agent_provider: "router",
      model_identifier: "qwen/qwen3-coder",
      reasoning_effort: "off",
    },
    fallback_configurations: [],
    revision,
  };
}

beforeEach(() => {
  vi.mocked(readAgentEnablement).mockReset();
  vi.mocked(enableAgentEnablement).mockReset().mockResolvedValue(enablement("enabled", 6));
  vi.mocked(disableAgentEnablement).mockReset().mockResolvedValue(enablement("disabled", 6));
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.info).mockReset();
});

describe("useEnablementSwitch", () => {
  it("enables a disabled agent at the revision that it reads again, with no confirmation", async () => {
    vi.mocked(readAgentEnablement).mockResolvedValue(enablement("disabled", 5));
    const reload = vi.fn();
    const { result } = renderHook(() =>
      useEnablementSwitch({ agentName: "swe@1", state: "disabled" }, reload),
    );

    await act(async () => result.current.run());

    expect(readAgentEnablement).toHaveBeenCalledWith("swe@1");
    expect(enableAgentEnablement).toHaveBeenCalledWith("swe@1", 5);
    expect(result.current.confirming).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("swe@1 is enabled at revision 6.");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("asks for a confirmation before it disables, then disables at the read revision", async () => {
    vi.mocked(readAgentEnablement).mockResolvedValue(enablement("enabled", 5));
    const reload = vi.fn();
    const { result } = renderHook(() =>
      useEnablementSwitch({ agentName: "swe@1", state: "enabled" }, reload),
    );

    await act(async () => result.current.run());

    expect(result.current.confirming).toBe(true);
    expect(disableAgentEnablement).not.toHaveBeenCalled();

    await act(async () => result.current.confirm());

    expect(disableAgentEnablement).toHaveBeenCalledWith("swe@1", 5);
    expect(result.current.confirming).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when a cancel closes the confirmation", async () => {
    vi.mocked(readAgentEnablement).mockResolvedValue(enablement("enabled", 5));
    const { result } = renderHook(() =>
      useEnablementSwitch({ agentName: "swe@1", state: "enabled" }, vi.fn()),
    );

    await act(async () => result.current.run());
    act(() => result.current.cancel());

    expect(result.current.confirming).toBe(false);
    expect(disableAgentEnablement).not.toHaveBeenCalled();
  });

  it("writes nothing and reloads when the state changed after the view read", async () => {
    vi.mocked(readAgentEnablement).mockResolvedValue(enablement("disabled", 7));
    const reload = vi.fn();
    const { result } = renderHook(() =>
      useEnablementSwitch({ agentName: "swe@1", state: "enabled" }, reload),
    );

    await act(async () => result.current.run());

    expect(result.current.confirming).toBe(false);
    expect(disableAgentEnablement).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("swe@1 did not change.", {
      description: "swe@1 is already disabled. The view now shows its current state.",
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the failure and writes nothing when the read fails", async () => {
    vi.mocked(readAgentEnablement).mockRejectedValue(
      new ApiError("not_found", "No enablement exists.", 404),
    );
    const { result } = renderHook(() =>
      useEnablementSwitch({ agentName: "swe@1", state: "disabled" }, vi.fn()),
    );

    await act(async () => result.current.run());

    expect(enableAgentEnablement).not.toHaveBeenCalled();
    expect(result.current.failure).toBe("No enablement exists.");
    expect(result.current.pending).toBe(false);
  });

  it("shows the failure of a refused write", async () => {
    vi.mocked(readAgentEnablement).mockResolvedValue(enablement("disabled", 5));
    vi.mocked(enableAgentEnablement).mockRejectedValue(
      new ApiError("conflict", "The enablement changed after the read.", 409),
    );
    const reload = vi.fn();
    const { result } = renderHook(() =>
      useEnablementSwitch({ agentName: "swe@1", state: "disabled" }, reload),
    );

    await act(async () => result.current.run());

    expect(result.current.failure).toBe("The enablement changed after the read.");
    expect(reload).not.toHaveBeenCalled();
  });
});
