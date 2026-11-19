import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as agentApi from "@/api/resources/agent";
import type { AgentDeclaration, AgentVariant } from "@/api/types";

vi.mock("@/api/resources/agent");

import { useVariant } from "./use-variant";

const VARIANT: AgentVariant = {
  id: "agent_variant_1",
  agent_name: "swe@1",
  display_name: "Software Architecture",
  instruction: "Text.",
  revision: 1,
};

const DECLARATION = {
  agent_name: "swe@1",
  prompt: { parts: [], final: null },
} as unknown as AgentDeclaration;

describe("useVariant", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(agentApi.readAgentVariant).mockResolvedValue(VARIANT);
    vi.mocked(agentApi.readAgentVariantPrompt).mockResolvedValue(DECLARATION);
  });

  it("reads the variant and then its prompt", async () => {
    const { result } = renderHook(() => useVariant("swe@1", "agent_variant_1"));

    await waitFor(() =>
      expect(result.current.data).toEqual({ variant: VARIANT, declaration: DECLARATION }),
    );
    expect(agentApi.readAgentVariantPrompt).toHaveBeenCalledWith("swe@1", "agent_variant_1");
  });

  it("answers a not_found error for a variant of another agent and reads no prompt", async () => {
    const { result } = renderHook(() => useVariant("re@1", "agent_variant_1"));

    await waitFor(() => expect(result.current.error?.detail).toBe("agent.variant.not_found"));
    expect(result.current.error?.status).toBe(404);
    expect(agentApi.readAgentVariantPrompt).not.toHaveBeenCalled();
  });
});
