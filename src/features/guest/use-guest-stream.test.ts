import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openStream } from "@/api/client";
import { ApiError } from "@/api/errors";
import { readGuestSession } from "@/api/resources/workbench";
import type { WorkbenchGuestEntry, WorkbenchGuestSession } from "@/api/types";
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

function entry(sessionId: string, id: string): WorkbenchGuestEntry {
  return {
    session_id: sessionId,
    agent_name: "swe@1",
    id,
    timestamp: "2026-10-05T09:00:00.000Z",
    kind: "user",
    text: id,
  };
}

function session(entries: readonly WorkbenchGuestEntry[]): WorkbenchGuestSession {
  return {
    session_id: "s1",
    title: "Shared",
    members: MEMBERS,
    owner_name: "Kanthor Labs",
    entries,
    run_active: false,
  };
}

function entriesFrame(...entries: readonly WorkbenchGuestEntry[]) {
  return { event: "entries", data: JSON.stringify(entries) };
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
    const frame = (text: string | null) => ({
      event: "state",
      data: JSON.stringify({
        run_active: true,
        display_name: "SWE",
        auto_mode: false,
        streaming: text === null ? null : { content: [{ type: "text", text }] },
      }),
    });
    openStreamMock.mockReturnValue(framesOf(frame("one"), frame("two")));

    const { result } = renderHook(() => useGuestStream(CONNECTION));
    await advance(0);

    expect(result.current.state).toEqual({
      run_active: true,
      display_name: "SWE",
      auto_mode: false,
      streaming: { content: [{ type: "text", text: "two" }] },
    });
  });

  it("keeps the state null until the first state frame", async () => {
    readMock.mockResolvedValue(session([]));
    openStreamMock.mockReturnValue(framesOf());

    const { result } = renderHook(() => useGuestStream(CONNECTION));
    await advance(0);

    expect(result.current.session).not.toBeNull();
    expect(result.current.state).toBeNull();
  });

  it("keeps a null display name of the state frame", async () => {
    readMock.mockResolvedValue(session([]));
    openStreamMock.mockReturnValue(
      framesOf({
        event: "state",
        data: JSON.stringify({
          run_active: false,
          display_name: null,
          auto_mode: true,
          streaming: null,
        }),
      }),
    );

    const { result } = renderHook(() => useGuestStream(CONNECTION));
    await advance(0);

    expect(result.current.state?.display_name).toBeNull();
  });

  it("removes the stored guest session on a 401 invite_ended and keeps the error line", async () => {
    window.sessionStorage.setItem("kanthord.guest", "{}");
    readMock.mockRejectedValue(
      new ApiError(
        "unauthorized",
        "The invite of this guest ended.",
        401,
        "gateway.jwt.invite_ended",
      ),
    );

    const { result } = renderHook(() => useGuestStream(CONNECTION));
    await advance(0);

    expect(window.sessionStorage.getItem("kanthord.guest")).toBeNull();
    expect(result.current.failure?.code).toBe("gateway.jwt.invite_ended");
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
