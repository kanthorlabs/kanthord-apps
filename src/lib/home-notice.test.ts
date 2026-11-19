import { describe, expect, it } from "vitest";

import type { WorkbenchSessionListItem } from "@/api/types";
import { homeNoticesOf } from "./home-notice";

const NOTICE = "shop · 2 Completed, 1 Discarded";

function item(id: string, patch: Partial<WorkbenchSessionListItem> = {}): WorkbenchSessionListItem {
  return {
    id,
    host_session_id: null,
    agent_name: "ops@1",
    variant_id: null,
    display_name: "Yumi",
    name: "Release plan",
    created: 1_000,
    modified: 2_000,
    message_count: 2,
    first_message: "Plan the release",
    run_active: false,
    forked_from: null,
    pending_approval: null,
    scope_requests: 0,
    notice: null,
    participants: [],
    ...patch,
  };
}

describe("homeNoticesOf", () => {
  it("gives one entry with the title and the notice text", () => {
    expect(homeNoticesOf([item("session_1", { notice: NOTICE })])).toEqual([
      { sessionId: "session_1", text: `Release plan: ${NOTICE}` },
    ]);
  });

  it("gives no entry for a null notice", () => {
    expect(homeNoticesOf([item("session_1")])).toEqual([]);
  });

  it("orders two entries by the oldest modified first", () => {
    const entries = homeNoticesOf([
      item("session_new", { notice: NOTICE, modified: 9_000 }),
      item("session_old", { notice: NOTICE, modified: 3_000 }),
    ]);

    expect(entries.map((entry) => entry.sessionId)).toEqual(["session_old", "session_new"]);
  });
});
