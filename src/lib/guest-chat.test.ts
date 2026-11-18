import { describe, expect, it } from "vitest";

import type { WorkbenchGuestEntry, WorkbenchGuestState, WorkbenchMember } from "@/api/types";
import { guestItemsOf } from "./guest-chat";

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
