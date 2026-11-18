import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readMissionNode } from "@/api/resources/mission";
import { approveWorkbenchCall } from "@/api/resources/workbench";
import type { MissionNodeRecord, WorkbenchPendingApproval } from "@/api/types";
import { useEvidenceAllow } from "./use-evidence-allow";

vi.mock("@/api/resources/mission", () => ({ readMissionNode: vi.fn() }));
vi.mock("@/api/resources/workbench", () => ({ approveWorkbenchCall: vi.fn() }));

const readMock = vi.mocked(readMissionNode);
const approveMock = vi.mocked(approveWorkbenchCall);

const APPROVAL: WorkbenchPendingApproval = {
  session_id: "session_1",
  requested_by: { kind: "owner", name: "Kanthor Labs" },
  tool_call_id: "call_1",
  operation_id: "mission.evidence.asset.content.download",
  guard: null,
  input: {
    node_id: "node_42",
    attempt: 3,
    evidence_id: "evidence_1",
    asset_id: "evidence_asset_9",
    kind: "object",
    shared: true,
  },
};

function nodeNamed(name: string): MissionNodeRecord {
  return { id: "node_42", content: { name } } as unknown as MissionNodeRecord;
}

beforeEach(() => {
  readMock.mockReset();
  approveMock.mockReset();
});

describe("useEvidenceAllow", () => {
  it("reads the node of the call when the card opens", async () => {
    readMock.mockResolvedValue(nodeNamed("Add password reset"));

    const { result } = renderHook(() => useEvidenceAllow(APPROVAL, vi.fn()));

    await waitFor(() => expect(result.current.nodeName).toBe("Add password reset"));
    expect(readMock).toHaveBeenCalledWith("node_42");
  });

  it("allows only an exact match of the node name", async () => {
    readMock.mockResolvedValue(nodeNamed("Add password reset"));
    const { result } = renderHook(() => useEvidenceAllow(APPROVAL, vi.fn()));
    await waitFor(() => expect(result.current.nodeName).not.toBeNull());

    act(() => result.current.setTyped("add password reset"));
    expect(result.current.canAllow).toBe(false);

    act(() => result.current.setTyped("Add password reset "));
    expect(result.current.canAllow).toBe(false);

    act(() => result.current.setTyped("Add password reset"));
    expect(result.current.canAllow).toBe(true);
  });

  it("does not allow before the node is read", () => {
    readMock.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useEvidenceAllow(APPROVAL, vi.fn()));

    act(() => result.current.setTyped(""));
    expect(result.current.canAllow).toBe(false);
  });

  it("approves with the typed text as node_name and reports the allow", async () => {
    readMock.mockResolvedValue(nodeNamed("Add password reset"));
    approveMock.mockResolvedValue({
      session_id: "session_1",
      tool_call_id: "call_1",
      approved: true,
    });
    const onAllowed = vi.fn();
    const { result } = renderHook(() => useEvidenceAllow(APPROVAL, onAllowed));
    await waitFor(() => expect(result.current.nodeName).not.toBeNull());
    act(() => result.current.setTyped("Add password reset"));

    await act(() => result.current.allow());

    expect(approveMock).toHaveBeenCalledWith("session_1", "call_1", true, "Add password reset");
    expect(onAllowed).toHaveBeenCalledTimes(1);
  });

  it("sends no approval while the text differs", async () => {
    readMock.mockResolvedValue(nodeNamed("Add password reset"));
    const { result } = renderHook(() => useEvidenceAllow(APPROVAL, vi.fn()));
    await waitFor(() => expect(result.current.nodeName).not.toBeNull());
    act(() => result.current.setTyped("Add"));

    await act(() => result.current.allow());

    expect(approveMock).not.toHaveBeenCalled();
  });

  it("reads the node again on a 409 and shows the fresh name", async () => {
    readMock
      .mockResolvedValueOnce(nodeNamed("Add password reset"))
      .mockResolvedValue(nodeNamed("Add password recovery"));
    approveMock.mockRejectedValue(
      new ApiError(
        "conflict",
        "The typed name does not match.",
        409,
        "workbench.evidence.name_mismatch",
      ),
    );
    const onAllowed = vi.fn();
    const { result } = renderHook(() => useEvidenceAllow(APPROVAL, onAllowed));
    await waitFor(() => expect(result.current.nodeName).toBe("Add password reset"));
    act(() => result.current.setTyped("Add password reset"));

    await act(() => result.current.allow());

    await waitFor(() => expect(result.current.nodeName).toBe("Add password recovery"));
    expect(readMock).toHaveBeenCalledTimes(2);
    expect(result.current.failure).toEqual({
      code: "workbench.evidence.name_mismatch",
      message: "The typed name does not match the node name. The card read the node again.",
    });
    expect(result.current.canAllow).toBe(false);
    expect(onAllowed).not.toHaveBeenCalled();
  });

  it("shows the code and the message of another failure", async () => {
    readMock.mockResolvedValue(nodeNamed("Add password reset"));
    approveMock.mockRejectedValue(
      new ApiError(
        "conflict",
        "The session holds no pending approval.",
        409,
        "workbench.session.approval_not_found",
      ),
    );
    const { result } = renderHook(() => useEvidenceAllow(APPROVAL, vi.fn()));
    await waitFor(() => expect(result.current.nodeName).not.toBeNull());
    act(() => result.current.setTyped("Add password reset"));

    await act(() => result.current.allow());

    expect(result.current.failure).toEqual({
      code: "workbench.session.approval_not_found",
      message: "The session holds no pending approval.",
    });
    expect(readMock).toHaveBeenCalledTimes(1);
  });
});
