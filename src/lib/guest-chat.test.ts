import { describe, expect, it } from "vitest";

import type { WorkbenchGuestEntry, WorkbenchGuestState, WorkbenchMember } from "@/api/types";
import { guestItemsOf, guestQueueRowOf } from "./guest-chat";

const RE_SESSION = "workbench_session_1";
const YUMI_SESSION = "workbench_session_2";
const MEMBERS: readonly WorkbenchMember[] = [
  { session_id: RE_SESSION, agent_name: "re@1", display_name: "RE" },
  { session_id: YUMI_SESSION, agent_name: "yumi@1", display_name: "Yumi" },
];
const YUMI_ENTRY: WorkbenchGuestEntry = {
  id: "e1",
  session_id: YUMI_SESSION,
  agent_name: "yumi@1",
  timestamp: "2026-10-05T09:00:00.000Z",
  kind: "user",
  text: "Ask RE",
};

function streamingState(displayName: string | null): WorkbenchGuestState {
  return {
    run_active: true,
    display_name: displayName,
    auto_mode: true,
    streaming: { content: [{ type: "text", text: "Reading the" }] },
    waiting_for_approval: null,
    queue: [],
  };
}

function streamingItem(displayName: string | null) {
  const items = guestItemsOf([YUMI_ENTRY], streamingState(displayName), MEMBERS);
  return items.find((item) => item.id === "streaming");
}

describe("guestItemsOf", () => {
  it("resolves the streaming member by the display name of the state", () => {
    expect(streamingItem("RE")).toMatchObject({
      session_id: RE_SESSION,
      agent_name: "re@1",
      display_name: "RE",
    });
  });

  it("takes the member of the last entry when the display name is null", () => {
    expect(streamingItem(null)).toMatchObject({
      session_id: YUMI_SESSION,
      agent_name: "yumi@1",
      display_name: "Yumi",
    });
  });

  it("takes the member of the last entry when the display name matches no member", () => {
    expect(streamingItem("Ghost")).toMatchObject({
      session_id: YUMI_SESSION,
      agent_name: "yumi@1",
      display_name: "Ghost",
    });
  });
});

describe("guestItemsOf labels", () => {
  const author = (id: string, sessionId: string, name: string): WorkbenchGuestEntry => ({
    id,
    session_id: sessionId,
    agent_name: "re@1",
    timestamp: "2026-10-05T09:00:00.000Z",
    kind: "author",
    author: { kind: "guest", name },
  });
  const user = (id: string, sessionId: string): WorkbenchGuestEntry => ({
    id,
    session_id: sessionId,
    agent_name: "re@1",
    timestamp: "2026-10-05T09:00:00.000Z",
    kind: "user",
    text: "Ask",
  });
  const note: WorkbenchGuestEntry = {
    id: "n1",
    session_id: YUMI_SESSION,
    agent_name: "yumi@1",
    timestamp: "2026-10-05T09:00:00.000Z",
    kind: "note",
    text: "Hello",
    author: { kind: "owner", name: "Kanthor Labs" },
  };

  it("labels the user entry of the same session when a note sits between", () => {
    const items = guestItemsOf(
      [author("a1", RE_SESSION, "Dana"), note, user("u1", RE_SESSION)],
      null,
      MEMBERS,
    );

    expect(items.find((item) => item.id === "u1")).toMatchObject({ guest: "Dana" });
  });

  it("leaves the user entry of another session unlabeled", () => {
    const items = guestItemsOf(
      [author("a1", YUMI_SESSION, "Dana"), user("u1", RE_SESSION)],
      null,
      MEMBERS,
    );

    expect(items.find((item) => item.id === "u1")).not.toHaveProperty("guest");
  });

  it("clears the author name after the first user entry", () => {
    const items = guestItemsOf(
      [author("a1", RE_SESSION, "Dana"), user("u1", RE_SESSION), user("u2", RE_SESSION)],
      null,
      MEMBERS,
    );

    expect(items.find((item) => item.id === "u1")).toMatchObject({ guest: "Dana" });
    expect(items.find((item) => item.id === "u2")).not.toHaveProperty("guest");
  });

  it("carries the text of a queue_clear entry", () => {
    const items = guestItemsOf(
      [
        {
          id: "q1",
          session_id: RE_SESSION,
          agent_name: "re@1",
          timestamp: "2026-10-05T09:00:00.000Z",
          kind: "queue_clear",
          count: 2,
          cause: "stop",
          text: "The owner stopped the run. 2 queued messages were cleared.",
        },
      ],
      null,
      MEMBERS,
    );

    expect(items).toMatchObject([
      { kind: "queue-clear", text: "The owner stopped the run. 2 queued messages were cleared." },
    ]);
  });
});

describe("guestQueueRowOf", () => {
  it("names the addressee and the author", () => {
    expect(
      guestQueueRowOf({ id: "q1", agent_name: "re@1", display_name: "RE", author_name: "Dana" }),
    ).toBe("to @RE · Dana");
  });

  it("reads the author name only for an untagged message", () => {
    expect(
      guestQueueRowOf({ id: "q1", agent_name: null, display_name: null, author_name: "Dana" }),
    ).toBe("Dana");
  });
});
