import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import type {
  WorkbenchMember,
  WorkbenchRunSnapshot,
  WorkbenchSessionEntry,
  WorkbenchSessionEvents,
} from "@/api/types";

vi.mock("@/api/resources/workbench");

import { EVENTS_BACKOFF_MS, useSessionEvents } from "./use-session-events";

const IDLE: WorkbenchRunSnapshot = {
  streaming_message: null,
  pending_tool_calls: [],
  pending_approval: null,
  queue: [],
  run_active: false,
  error_message: null,
  auto_mode: true,
};

const HOST: WorkbenchMember = {
  session_id: "session-1",
  agent_name: "ops@1",
  display_name: "Yumi",
};
const GUEST: WorkbenchMember = { session_id: "session-2", agent_name: "re@1", display_name: "RE" };

function entry(id: string, member: WorkbenchMember = HOST): WorkbenchSessionEntry {
  return {
    session_id: member.session_id,
    agent_name: member.agent_name,
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
  };
}

const never = () => new Promise<never>(() => undefined);

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSessionEvents", () => {
  it("follows the id of the last entry that it holds", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents)
      .mockResolvedValueOnce({
        entries: [entry("e3"), entry("e4")],
        members: [HOST],
        snapshot: IDLE,
        version: 1,
      })
      .mockImplementation(never);

    const { result } = renderHook(() =>
      useSessionEvents("session-1", [entry("e1"), entry("e2")], [HOST], false),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.entries.map((held) => held.id)).toEqual(["e1", "e2", "e3", "e4"]);
    const calls = vi.mocked(workbenchApi.readWorkbenchEvents).mock.calls;
    expect(calls.map((call) => call[1])).toEqual(["e2", "e4"]);
  });

  it("sends one pair per member once a participant joins and shows no entry twice", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents)
      .mockResolvedValueOnce({
        entries: [entry("e3", GUEST)],
        members: [HOST, GUEST],
        snapshot: IDLE,
        version: 1,
      })
      .mockResolvedValueOnce({
        entries: [entry("e3", GUEST), entry("e4", HOST), entry("e4", GUEST)],
        members: [HOST, GUEST],
        snapshot: IDLE,
        version: 2,
      })
      .mockImplementation(never);

    const { result } = renderHook(() =>
      useSessionEvents("session-1", [entry("e1"), entry("e2")], [HOST], false),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const calls = vi.mocked(workbenchApi.readWorkbenchEvents).mock.calls;
    expect(calls.map((call) => call[1])).toEqual([
      "e2",
      "session-1:e2,session-2:e3",
      "session-1:e4,session-2:e4",
    ]);
    expect(result.current.members).toEqual([HOST, GUEST]);
    expect(result.current.entries.map((held) => `${held.session_id}:${held.id}`)).toEqual([
      "session-1:e1",
      "session-1:e2",
      "session-2:e3",
      "session-1:e4",
      "session-2:e4",
    ]);
  });

  it("keeps the order of the answer and sorts nothing", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents)
      .mockResolvedValueOnce({
        entries: [entry("e9", GUEST), entry("e3", HOST)],
        members: [HOST, GUEST],
        snapshot: IDLE,
        version: 1,
      })
      .mockImplementation(never);

    const { result } = renderHook(() => useSessionEvents("session-1", [], [HOST, GUEST], false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.entries.map((held) => held.id)).toEqual(["e9", "e3"]);
  });

  it("sends the version of the last answer with the next poll", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents)
      .mockResolvedValueOnce({ entries: [], members: [HOST], snapshot: IDLE, version: 7 })
      .mockImplementation(never);

    renderHook(() => useSessionEvents("session-1", [], [HOST], false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const calls = vi.mocked(workbenchApi.readWorkbenchEvents).mock.calls;
    expect(calls.map((call) => call[2])).toEqual([null, 7]);
  });

  it("polls without after for a session that holds no entry", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents).mockImplementation(never);

    renderHook(() => useSessionEvents("session-1", [], [HOST], false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(vi.mocked(workbenchApi.readWorkbenchEvents).mock.calls[0]?.[1]).toBeNull();
  });

  it("reports the snapshot of the active run", async () => {
    const snapshot = {
      ...IDLE,
      run_active: true,
      streaming_message: { role: "assistant", content: [{ type: "text", text: "Hel" }] },
    };
    vi.mocked(workbenchApi.readWorkbenchEvents)
      .mockResolvedValueOnce({ entries: [], members: [HOST], snapshot, version: 1 })
      .mockImplementation(never);

    const { result } = renderHook(() => useSessionEvents("session-1", [], [HOST], false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.snapshot).toEqual(snapshot);
  });

  it("does not hold an entry twice", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents)
      .mockResolvedValueOnce({
        entries: [entry("e1"), entry("e2")],
        members: [HOST],
        snapshot: IDLE,
        version: 1,
      })
      .mockImplementation(never);

    const { result } = renderHook(() =>
      useSessionEvents("session-1", [entry("e1")], [HOST], false),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.entries.map((held) => held.id)).toEqual(["e1", "e2"]);
  });

  it("waits for the backoff after a failure and then polls again", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents)
      .mockRejectedValueOnce(new ApiError("unreachable", "The daemon did not answer.", 0))
      .mockResolvedValueOnce({
        entries: [entry("e1")],
        members: [HOST],
        snapshot: IDLE,
        version: 1,
      })
      .mockImplementation(never);

    const { result } = renderHook(() => useSessionEvents("session-1", [], [HOST], false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.failure).toBe("The daemon did not answer.");
    expect(workbenchApi.readWorkbenchEvents).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVENTS_BACKOFF_MS);
    });

    expect(workbenchApi.readWorkbenchEvents).toHaveBeenCalledTimes(3);
    expect(result.current.failure).toBeNull();
    expect(result.current.entries.map((held) => held.id)).toEqual(["e1"]);
  });

  it("stops after a failure that no retry can fix", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents).mockRejectedValue(
      new ApiError("not_found", "The workbench session does not exist.", 404),
    );

    const { result } = renderHook(() => useSessionEvents("session-1", [], [HOST], false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVENTS_BACKOFF_MS * 3);
    });

    expect(result.current.failure).toBe("The workbench session does not exist.");
    expect(workbenchApi.readWorkbenchEvents).toHaveBeenCalledTimes(1);
  });

  it("stops the loop on unmount", async () => {
    let answer: (events: WorkbenchSessionEvents) => void = () => undefined;
    vi.mocked(workbenchApi.readWorkbenchEvents).mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)),
    );

    const { unmount } = renderHook(() => useSessionEvents("session-1", [], [HOST], false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const signal = vi.mocked(workbenchApi.readWorkbenchEvents).mock.calls[0]?.[3];
    unmount();
    answer({ entries: [], members: [HOST], snapshot: IDLE, version: 1 });
    await vi.advanceTimersByTimeAsync(EVENTS_BACKOFF_MS * 3);

    expect(signal?.aborted).toBe(true);
    expect(workbenchApi.readWorkbenchEvents).toHaveBeenCalledTimes(1);
  });

  it("holds an idle snapshot with an empty queue before the first answer", () => {
    vi.mocked(workbenchApi.readWorkbenchEvents).mockImplementation(never);

    const { result } = renderHook(() => useSessionEvents("session-1", [], [HOST], false));

    expect(result.current.snapshot).toEqual(IDLE);
    expect(result.current.snapshot.queue).toEqual([]);
  });

  it("patches the snapshot until the next answer replaces it", () => {
    vi.mocked(workbenchApi.readWorkbenchEvents).mockImplementation(never);

    const { result } = renderHook(() => useSessionEvents("session-1", [], [HOST], false));
    act(() => result.current.patchSnapshot({ run_active: true }));

    expect(result.current.snapshot.run_active).toBe(true);
  });
});
