import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as agentApi from "@/api/resources/agent";
import type { AgentVariant } from "@/api/types";

vi.mock("@/api/resources/agent");

import { useVariantCreate } from "./use-variant-create";

const CREATED: AgentVariant = {
  id: "agent_variant_1",
  agent_name: "swe@1",
  display_name: "Software Architecture",
  instruction: "Text.",
  revision: 1,
};

function filled(onCreated = vi.fn()) {
  const hook = renderHook(() => useVariantCreate("swe@1", onCreated));
  act(() => {
    hook.result.current.setName(" Software Architecture ");
    hook.result.current.setInstruction("Text.");
  });
  return { hook, onCreated };
}

describe("useVariantCreate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates the variant with the trimmed name and reports it", async () => {
    vi.mocked(agentApi.createAgentVariant).mockResolvedValue(CREATED);
    const { hook, onCreated } = filled();

    await act(() => hook.result.current.submit());

    expect(agentApi.createAgentVariant).toHaveBeenCalledWith({
      agent_name: "swe@1",
      display_name: "Software Architecture",
      instruction: "Text.",
    });
    expect(onCreated).toHaveBeenCalledWith(CREATED);
    expect(hook.result.current.failure).toBeNull();
  });

  it("refuses a name that breaks the rule before any call", async () => {
    const { hook, onCreated } = filled();
    act(() => hook.result.current.setName("1st"));

    await act(() => hook.result.current.submit());

    expect(hook.result.current.failure?.field).toBe("name");
    expect(agentApi.createAgentVariant).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("refuses a blank instruction before any call", async () => {
    const { hook, onCreated } = filled();
    act(() => hook.result.current.setInstruction("  "));

    await act(() => hook.result.current.submit());

    expect(hook.result.current.failure?.field).toBe("instruction");
    expect(agentApi.createAgentVariant).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("keeps the draft and the failure of a refused create, and clears the failure on an edit", async () => {
    vi.mocked(agentApi.createAgentVariant).mockRejectedValue(
      new ApiError("conflict", "Taken.", 409, "agent.variant.name_taken"),
    );
    const { hook, onCreated } = filled();

    await act(() => hook.result.current.submit());

    expect(hook.result.current.failure?.field).toBe("name");
    expect(hook.result.current.name).toBe(" Software Architecture ");
    expect(hook.result.current.instruction).toBe("Text.");
    expect(onCreated).not.toHaveBeenCalled();
    act(() => hook.result.current.setName("Other"));
    expect(hook.result.current.failure).toBeNull();
  });
});
