import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { decideFinding } from "@/api/resources/mission";
import type { MissionFinding } from "@/api/types";
import { useFindingDecision } from "./use-finding-decision";

vi.mock("@/api/resources/mission", () => ({ decideFinding: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const decideMock = vi.mocked(decideFinding);

const REPORTED: MissionFinding = {
  id: "finding_1",
  node_id: "node_signup",
  attempt: 1,
  round: 3,
  assessment_id: "assessment_3",
  source: "reviewer",
  label: "S2",
  kind: "suggestion",
  action: "yes",
  task_id: null,
  ground: null,
  name: "Submit while pending",
  description: "A second click sends the form twice.",
  fix: "Disable the button while the request is pending.",
  why: "A double submit creates two accounts.",
  route: "report",
  status: "open",
  fixed_assessment_id: null,
  cause_owner: null,
  created_by: null,
  created_at: 0,
  decision: null,
  decision_reason: null,
  decided_by: null,
  decided_at: null,
};

function mount(reload = vi.fn()) {
  const view = renderHook(() => useFindingDecision(reload));
  return { ...view, reload };
}

beforeEach(() => {
  decideMock.mockReset().mockResolvedValue({ ...REPORTED, decision: "dismissed" });
});

describe("useFindingDecision", () => {
  it("sends the decision and the trimmed reason, then closes and reloads", async () => {
    const { result, reload } = mount();

    act(() => result.current.request(REPORTED, "dismissed"));
    act(() => result.current.setReason("  The form already blocks a second submit.  "));
    await act(async () => result.current.confirm());

    expect(decideMock).toHaveBeenCalledWith("finding_1", {
      decision: "dismissed",
      decision_reason: "The form already blocks a second submit.",
    });
    expect(result.current.open).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Dismissed the finding S2.");
  });

  it("sends nothing while the reason is blank", async () => {
    const { result } = mount();

    act(() => result.current.request(REPORTED, "accepted"));
    act(() => result.current.setReason("   "));
    await act(async () => result.current.confirm());

    expect(result.current.reasonMissing).toBe(true);
    expect(decideMock).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });

  it("opens no decision for a finding that does not wait for a human", () => {
    const { result } = mount();

    act(() => result.current.request({ ...REPORTED, route: "fix" }, "accepted"));
    expect(result.current.open).toBe(false);
    act(() => result.current.request({ ...REPORTED, decision: "accepted" }, "accepted"));
    expect(result.current.open).toBe(false);
  });

  it("starts each request with an empty reason", () => {
    const { result } = mount();

    act(() => result.current.request(REPORTED, "accepted"));
    act(() => result.current.setReason("Old"));
    act(() => result.current.cancel());
    act(() => result.current.request(REPORTED, "dismissed"));

    expect(result.current.reason).toBe("");
    expect(result.current.decision).toBe("dismissed");
  });

  it.each([
    ["mission.finding.decided", "Another decision of this finding came first."],
    ["mission.finding.not_reported", "The finding no longer waits for a human decision."],
  ])("maps the refusal %s to a message and reloads", async (code, message) => {
    decideMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request(REPORTED, "accepted"));
    act(() => result.current.setReason("A follow-up node adds it."));
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(toast.error).toHaveBeenCalledWith("Accepting the finding S2 failed.", {
      description: expect.stringContaining(message),
    });
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
