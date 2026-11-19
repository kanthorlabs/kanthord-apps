import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as agentApi from "@/api/resources/agent";
import type { AgentVariant } from "@/api/types";

vi.mock("@/api/resources/agent");

import { useVariantUpdate } from "./use-variant-update";

const VARIANT: AgentVariant = {
  id: "agent_variant_1",
  agent_name: "swe@1",
  display_name: "Software Architecture",
  instruction: "Text.",
  revision: 1,
};

function started(onSaved = vi.fn()) {
  const hook = renderHook(() => useVariantUpdate(VARIANT, onSaved));
  act(() => hook.result.current.start());
  return { hook, onSaved };
}

describe("useVariantUpdate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("starts with the stored draft", () => {
    const { hook } = started();

    expect(hook.result.current.open).toBe(true);
    expect(hook.result.current.name).toBe("Software Architecture");
    expect(hook.result.current.instruction).toBe("Text.");
  });

  it("saves with the expected revision, closes and marks the save", async () => {
    vi.mocked(agentApi.updateAgentVariant).mockResolvedValue({ ...VARIANT, revision: 2 });
    const { hook, onSaved } = started();
    act(() => hook.result.current.setInstruction("New text."));

    await act(() => hook.result.current.submit());

    expect(agentApi.updateAgentVariant).toHaveBeenCalledWith("agent_variant_1", {
      display_name: "Software Architecture",
      instruction: "New text.",
      expected_revision: 1,
    });
    expect(hook.result.current.open).toBe(false);
    expect(hook.result.current.saved).toBe(true);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft on a conflict and sends the revision of the current row next", async () => {
    const current = { ...VARIANT, revision: 5 };
    vi.mocked(agentApi.updateAgentVariant)
      .mockRejectedValueOnce(
        new ApiError("conflict", "Changed.", 409, "agent.variant.revision_conflict", { current }),
      )
      .mockResolvedValueOnce({ ...current, revision: 6 });
    const { hook } = started();
    act(() => hook.result.current.setInstruction("Mine."));

    await act(() => hook.result.current.submit());

    expect(hook.result.current.conflict).toEqual({ message: "Changed.", current });
    expect(hook.result.current.instruction).toBe("Mine.");
    expect(hook.result.current.open).toBe(true);
    await act(() => hook.result.current.submit());
    expect(agentApi.updateAgentVariant).toHaveBeenLastCalledWith(
      "agent_variant_1",
      expect.objectContaining({ instruction: "Mine.", expected_revision: 5 }),
    );
    expect(hook.result.current.conflict).toBeNull();
  });

  it("shows a conflict answer with no current row as a form line", async () => {
    vi.mocked(agentApi.updateAgentVariant).mockRejectedValue(
      new ApiError("conflict", "Changed.", 409, "agent.variant.revision_conflict"),
    );
    const { hook } = started();

    await act(() => hook.result.current.submit());

    expect(hook.result.current.conflict).toBeNull();
    expect(hook.result.current.failure?.field).toBe("form");
  });

  it("refuses a name that breaks the rule before any call", async () => {
    const { hook } = started();
    act(() => hook.result.current.setName("1st"));

    await act(() => hook.result.current.submit());

    expect(hook.result.current.failure?.field).toBe("name");
    expect(agentApi.updateAgentVariant).not.toHaveBeenCalled();
  });
});
