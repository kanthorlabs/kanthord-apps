import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openStream } from "@/api/client";
import { ApiError } from "@/api/errors";
import { readGuestSession } from "@/api/resources/workbench";
import type { WorkbenchGuestSession, WorkbenchSessionEntry } from "@/api/types";
import { useGuestStream } from "./use-guest-stream";

vi.mock("@/api/client", () => ({ openStream: vi.fn() }));
vi.mock("@/api/resources/workbench", () => ({ readGuestSession: vi.fn() }));

const openStreamMock = vi.mocked(openStream);
const readMock = vi.mocked(readGuestSession);

const GUEST_BEARER = "guest-bearer-1";
const CONNECTION = { baseUrl: "http://localhost:31415", token: GUEST_BEARER };
const MEMBERS = [
  { session_id: "s1", agent_name: "swe@1", display_name: "SWE" },
  { session_id: "s2", agent_name: "plan@1", display_name: "Plan" },
];

function entry(sessionId: string, id: string): WorkbenchSessionEntry {
  return {
    session_id: sessionId,
    agent_name: "swe@1",
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    message: { role: "user", content: id },
  };
}

function session(entries: readonly WorkbenchSessionEntry[]): WorkbenchGuestSession {
  return {
    session_id: "s1",
    title: "Shared",
    members: MEMBERS,
    owner_name: "Kanthor Labs",
    entries,
    run_active: false,
  };
}

function entriesFrame(...entries: readonly WorkbenchSessionEntry[]) {
  return { event: "entries", data: JSON.stringify({ entries }) };
}

async function* framesOf(...frames: readonly { event: string; data: string }[]) {
  await Promise.resolve();
  yield* frames;
}

function afterOf(call: number): string | null {
  return new URL(String(openStreamMock.mock.calls[call]?.[0]), "http://x").searchParams.get(
    "after",
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  openStreamMock.mockReset();
  readMock.mockReset();
});

describe("useGuestStream", () => {
  it("opens the stream with the merged cursor and sends it again on a reconnect", async () => {
    readMock.mockResolvedValue(session([entry("s1", "e1"), entry("s2", "e2")]));
    openStreamMock
      .mockReturnValueOnce(framesOf(entriesFrame(entry("s1", "e3"))))
      .mockReturnValue(framesOf());

    renderHook(() => useGuestStream(CONNECTION));
    await advance(0);

    expect(afterOf(0)).toBe("s1:e1,s2:e2");

    await advance(1000);

    expect(openStreamMock).toHaveBeenCalledTimes(2);
    expect(afterOf(1)).toBe("s1:e3,s2:e2");
    expect(openStreamMock.mock.calls[1]?.[1]).toMatchObject({ connection: CONNECTION });
  });

  it("shows a repeated entry once", async () => {
    readMock.mockResolvedValue(session([entry("s1", "e1")]));
    openStreamMock.mockReturnValue(
      framesOf(entriesFrame(entry("s1", "e2")), entriesFrame(entry("s1", "e1"), entry("s1", "e2"))),
    );

    const { result } = renderHook(() => useGuestStream(CONNECTION));
    await advance(0);

    expect(result.current.entries.map((held) => held.id)).toEqual(["e1", "e2"]);
  });

  it("replaces the state on each state frame", async () => {
    readMock.mockResolvedValue(session([]));
    const frame = (streaming: string | null) => ({
      event: "state",
      data: JSON.stringify({
        run_active: true,
        display_name: "SWE",
        auto_mode: false,
        streaming,
      }),
    });
    openStreamMock.mockReturnValue(framesOf(frame("one"), frame("two")));

    const { result } = renderHook(() => useGuestStream(CONNECTION));
    await advance(0);

    expect(result.current.state).toEqual({
      run_active: true,
      display_name: "SWE",
      auto_mode: false,
      streaming: "two",
    });
  });

  it("stops on a 401 with no further request", async () => {
    readMock.mockResolvedValue(session([]));
    openStreamMock.mockImplementation(() => {
      throw new ApiError(
        "unauthorized",
        "The invite of this guest ended.",
        401,
        "gateway.jwt.invite_ended",
      );
    });

    const { result } = renderHook(() => useGuestStream(CONNECTION));
    await advance(0);
    await advance(10_000);

    expect(openStreamMock).toHaveBeenCalledTimes(1);
    expect(result.current.failure).toEqual({
      code: "gateway.jwt.invite_ended",
      message: "The invite of this guest ended.",
      final: true,
    });
  });
});
