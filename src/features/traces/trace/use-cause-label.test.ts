import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  labelTraceCause: vi.fn(),
}));

import { ApiError } from "@/api/errors";
import { labelTraceCause } from "@/api/resources/tracking";
import type { CauseLabel, EffectiveCause } from "@/api/types";

import { useCauseLabel } from "./use-cause-label";

const MODEL_CAUSE: EffectiveCause = {
  category: "model",
  assigner: "rule",
  subcategory: "no_progress",
};

const UNATTRIBUTED_CAUSE: EffectiveCause = {
  category: "unattributed",
  assigner: "rule",
  suspects: ["environment", "model"],
};

const ANSWER: CauseLabel = {
  trace_id: "trace-1",
  span_id: "root.cause_label",
  cause: { category: "human", assigner: "human", subcategory: "configuration" },
  reason: "Wrong setting.",
  created_at: 1000,
};

function setup(cause: EffectiveCause = MODEL_CAUSE) {
  const onLabeled = vi.fn();
  const hook = renderHook(() => useCauseLabel("trace-1", cause, onLabeled));
  return { ...hook, onLabeled };
}

beforeEach(() => {
  vi.mocked(labelTraceCause).mockReset();
});

describe("useCauseLabel", () => {
  it("starts at the cause category and subcategory", () => {
    const { result } = setup();

    expect(result.current.draft).toEqual({
      category: "model",
      subcategory: "no_progress",
      reason: "",
    });
  });

  it("starts an unattributed cause at the first suspect", () => {
    const { result } = setup(UNATTRIBUTED_CAUSE);

    expect(result.current.draft).toEqual({
      category: "environment",
      subcategory: "setup_failed",
      reason: "",
    });
  });

  it("starts an unattributed cause without suspects at an invalid category", () => {
    const { result } = setup({ category: "unattributed", assigner: "rule", suspects: [] });

    expect(result.current.draft.category).toBe("unattributed");
    expect(result.current.draft.subcategory).toBeNull();
    expect(result.current.errors.category).toBeDefined();
  });

  it("resets the subcategory to the first one of the new category", () => {
    const { result } = setup();

    act(() => result.current.setCategory("plan"));

    expect(result.current.draft.subcategory).toBe("criterion_unstated");
  });

  it("answers an error for an empty reason", () => {
    const { result } = setup();

    expect(result.current.errors.reason).toBeDefined();
    expect(result.current.valid).toBe(false);
  });

  it("answers an error for a reason of only spaces", () => {
    const { result } = setup();

    act(() => result.current.setReason("   "));

    expect(result.current.errors.reason).toBeDefined();
  });

  it("answers an error for a reason over 4096 characters", () => {
    const { result } = setup();

    act(() => result.current.setReason("a".repeat(4097)));

    expect(result.current.errors.reason).toBeDefined();
  });

  it("accepts a reason of 4096 characters", () => {
    const { result } = setup();

    act(() => result.current.setReason("a".repeat(4096)));

    expect(result.current.errors).toEqual({});
    expect(result.current.valid).toBe(true);
  });

  it("answers an error for the unattributed category", () => {
    const { result } = setup();

    act(() => result.current.setCategory("unattributed"));

    expect(result.current.errors.category).toBeDefined();
    expect(result.current.errors.subcategory).toBeDefined();
  });

  it("answers an error for a subcategory of another category", () => {
    const { result } = setup();

    act(() => result.current.setSubcategory("gate_commit"));

    expect(result.current.errors.subcategory).toBeDefined();
  });

  it("calls nothing when the draft is invalid", () => {
    const { result } = setup();

    act(() => result.current.submit());

    expect(labelTraceCause).not.toHaveBeenCalled();
  });

  it("calls labelTraceCause once with the body and reports the answer", async () => {
    let resolve: (label: CauseLabel) => void = () => undefined;
    vi.mocked(labelTraceCause).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result, onLabeled } = setup();
    act(() => result.current.setReason("  Wrong setting.  "));

    act(() => result.current.submit());
    act(() => result.current.submit());

    expect(result.current.pending).toBe(true);
    expect(labelTraceCause).toHaveBeenCalledTimes(1);
    expect(labelTraceCause).toHaveBeenCalledWith("trace-1", {
      category: "model",
      subcategory: "no_progress",
      reason: "Wrong setting.",
    });
    await act(async () => resolve(ANSWER));
    expect(result.current.pending).toBe(false);
    expect(onLabeled).toHaveBeenCalledWith(ANSWER);
  });

  it("keeps the message of an ApiError", async () => {
    vi.mocked(labelTraceCause).mockRejectedValue(
      new ApiError("refused", "The daemon refused the label.", 422),
    );
    const { result, onLabeled } = setup();
    act(() => result.current.setReason("Wrong setting."));

    act(() => result.current.submit());

    await waitFor(() => expect(result.current.failure).toBe("The daemon refused the label."));
    expect(result.current.pending).toBe(false);
    expect(onLabeled).not.toHaveBeenCalled();
  });

  it("explains an open trace", async () => {
    vi.mocked(labelTraceCause).mockRejectedValue(
      new ApiError("conflict", "The trace is still open.", 409, "tracking.cause.trace_open"),
    );
    const { result } = setup();
    act(() => result.current.setReason("Wrong setting."));

    act(() => result.current.submit());

    await waitFor(() =>
      expect(result.current.failure).toBe("The trace is still open. Label it after it ends."),
    );
  });
});
