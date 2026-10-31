import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { approveWorkbenchCall } from "@/api/resources/workbench";
import type { ToolApprovalItem } from "@/lib/approval-attention";

vi.mock("@/api/resources/workbench");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import type { BoardReadsState } from "./use-board-reads";
import { useBoardToolActs } from "./use-board-tool-acts";

const ITEM: ToolApprovalItem = {
  id: "tool_approval:s1",
  group: "decisions",
  kind: "tool_approval",
  subject: "Create project",
  at: 2,
  sessionId: "s1",
  toolCallId: "c1",
  agent: "swe@1",
  operationId: "project.create",
};

function readsOf(session: BoardReadsState["session"]): BoardReadsState {
  const retry = () => undefined;
  return {
    session,
    discard: null,
    evidence: null,
    transition: null,
    cause: null,
    retry: { session: retry, discard: retry, evidence: retry, transition: retry, cause: retry },
  };
}

const READY = readsOf({ status: "ready", data: null });
const PENDING = readsOf(null);

const reload = vi.fn();
const markActed = vi.fn();

function mount(reads: BoardReadsState = READY) {
  return renderHook(() => useBoardToolActs(ITEM, reads, { reload, markActed }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useBoardToolActs", () => {
  it("gates Approve until the session read is ready", () => {
    expect(mount(PENDING).result.current.need).toBe("Approve needs: the session read.");
    expect(mount(readsOf({ status: "failed", message: "down" })).result.current.need).toBe(
      "Approve needs: the session read.",
    );
    expect(mount().result.current.need).toBeNull();
  });

  it("approves with true and names the subject in the toast", async () => {
    vi.mocked(approveWorkbenchCall).mockResolvedValue({} as never);
    const { result } = mount();

    act(() => result.current.approve());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Approved Create project."));
    expect(approveWorkbenchCall).toHaveBeenCalledWith("s1", "c1", true);
    expect(markActed).toHaveBeenCalledWith("tool_approval:s1", { id: "approve" });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("rejects with false and names the subject in the toast", async () => {
    vi.mocked(approveWorkbenchCall).mockResolvedValue({} as never);
    const { result } = mount();

    act(() => result.current.reject());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rejected Create project."));
    expect(approveWorkbenchCall).toHaveBeenCalledWith("s1", "c1", false);
    expect(markActed).toHaveBeenCalledWith("tool_approval:s1", { id: "reject" });
  });

  it("keeps the failure line of a 404 answer and does not reload", async () => {
    vi.mocked(approveWorkbenchCall).mockRejectedValue(
      new ApiError(
        "not_found",
        "No approval waits for this call.",
        404,
        "workbench.session.approval_not_found",
      ),
    );
    const { result } = mount();

    act(() => result.current.approve());

    await waitFor(() =>
      expect(result.current.failure?.text).toBe(
        "Approving Create project failed. No approval waits for this call.",
      ),
    );
    expect(toast.error).toHaveBeenCalledWith("Approving Create project failed.", {
      description: "No approval waits for this call.",
    });
    expect(markActed).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("names Rejecting for a failed Reject and sends again on Retry", async () => {
    vi.mocked(approveWorkbenchCall)
      .mockRejectedValueOnce(new ApiError("unavailable", "Down.", 503))
      .mockResolvedValue({} as never);
    const { result } = mount();

    act(() => result.current.reject());
    await waitFor(() =>
      expect(result.current.failure?.text).toBe("Rejecting Create project failed. Down."),
    );
    act(() => result.current.failure?.retry());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rejected Create project."));
    expect(approveWorkbenchCall).toHaveBeenCalledTimes(2);
    expect(result.current.failure).toBeNull();
  });
});
