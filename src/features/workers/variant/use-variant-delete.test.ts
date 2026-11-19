import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as agentApi from "@/api/resources/agent";

vi.mock("@/api/resources/agent");

import { useVariantDelete } from "./use-variant-delete";

describe("useVariantDelete", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("deletes with the revision after the request and reports it", async () => {
    vi.mocked(agentApi.deleteAgentVariant).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useVariantDelete("agent_variant_1", 4, onDeleted));

    act(() => result.current.request());
    expect(result.current.open).toBe(true);
    expect(agentApi.deleteAgentVariant).not.toHaveBeenCalled();
    await act(() => result.current.confirm());

    expect(agentApi.deleteAgentVariant).toHaveBeenCalledWith("agent_variant_1", 4);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe(false);
  });

  it("keeps the dialog open with the in-use line for an in_use refusal", async () => {
    vi.mocked(agentApi.deleteAgentVariant).mockRejectedValue(
      new ApiError("conflict", "In use.", 409, "agent.variant.in_use"),
    );
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useVariantDelete("agent_variant_1", 4, onDeleted));

    act(() => result.current.request());
    await act(() => result.current.confirm());

    expect(result.current.failure).toEqual({
      code: "agent.variant.in_use",
      message: "This variant has sessions. Rename it or change its instruction.",
    });
    expect(result.current.open).toBe(true);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("shows the code and message of another refusal and clears them on cancel", async () => {
    vi.mocked(agentApi.deleteAgentVariant).mockRejectedValue(
      new ApiError("conflict", "The variant changed.", 409, "agent.variant.revision_conflict"),
    );
    const { result } = renderHook(() => useVariantDelete("agent_variant_1", 4, vi.fn()));

    act(() => result.current.request());
    await act(() => result.current.confirm());

    expect(result.current.failure).toEqual({
      code: "agent.variant.revision_conflict",
      message: "The variant changed.",
    });
    act(() => result.current.cancel());
    expect(result.current.failure).toBeNull();
    expect(result.current.open).toBe(false);
  });
});
