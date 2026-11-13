import { describe, expect, it } from "vitest";

import type { InboxItem, Project } from "@/api/types";

import type { AttentionItem } from "./attention";
import type { BoardGate } from "./board-items";
import { BOARD_TAB } from "./board-tabs";
import type { ToolApprovalItem } from "./approval-attention";
import {
  DECK_GONE_TEXT,
  deckCountTextOf,
  deckListOf,
  deckOrderOf,
  deckSummaryOf,
  deckTabsOf,
  doneTextOf,
  heldCountOf,
  heldOnTextOf,
  isAct,
  waitingTextOf,
} from "./home-deck";
import { inboxItemsOf } from "./inbox-attention";
import type { FixAttentionItem } from "./fix-attention";

const HOUR_MS = 3_600_000;
const NOW = Date.UTC(2026, 4, 12, 11, 0, 0);

function project(id: string, name: string): Project {
  return {
    id,
    name,
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: `/state/${id}`,
  };
}

const ATLAS = project("prj-1", "atlas");
const ORBIT = project("prj-2", "orbit");

function fix(id: string, at: number | null, subject = id, owner = ATLAS): FixAttentionItem {
  return {
    id,
    kind: "project_paused",
    group: "fixes",
    project: owner,
    projects: [owner],
    at,
    subject,
    cause: "Project paused",
    nodeIds: [],
  };
}

function tool(id: string, at: number): ToolApprovalItem {
  return {
    id,
    group: "decisions",
    kind: "tool_approval",
    subject: `Approve ${id}`,
    at,
    sessionId: `session-${id}`,
    toolCallId: `call-${id}`,
    agent: "ops@1",
    operationId: "project.create",
  };
}

function inboxThread(id: string, overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    link_update_id: id,
    project_id: ATLAS.id,
    external_link: { kind: "jira_issue", resource_identity: "conversation:jira:x", key: "KD-1" },
    reason: "linked",
    state: "open",
    occurred_at: 100,
    done_at: null,
    snoozed_until: null,
    inbound_event_id: "event_1",
    actor_id: "actor_1",
    trusted: true,
    linked_node_ids: [],
    content: null,
    ...overrides,
  };
}

const none = new Map<string, readonly string[]>();
const noGates = new Map<string, BoardGate>();
const details = new Map();

function idsOf(items: readonly AttentionItem[]): readonly string[] {
  return items.map((item) => item.id);
}

describe("deckOrderOf", () => {
  it("ranks a tool approval before a gated or held item, oldest first", () => {
    const held = new Map([["held", ["n1", "n2"]]]);
    const gates = new Map([["gated", { itemId: "x", need: "Rotate", short: "Rotate" }]]);
    const items = [fix("gated", 1), fix("held", 2), tool("late", 900), tool("early", 800)];

    expect(idsOf(deckOrderOf(items, held, gates))).toEqual(["early", "late", "held", "gated"]);
  });

  it("keeps the order of rankBoardItems for the other items", () => {
    const held = new Map([["more", ["n1", "n2"]]]);
    const gates = new Map([["gated", { itemId: "x", need: "Rotate", short: "Rotate" }]]);
    const items = [
      fix("gated", 1),
      fix("young", 300),
      fix("old", 100),
      fix("more", 500),
      fix("unknown", null),
    ];

    expect(idsOf(deckOrderOf(items, held, gates))).toEqual([
      "more",
      "old",
      "young",
      "unknown",
      "gated",
    ]);
  });

  it("ranks inbox items last", () => {
    const inbox = inboxItemsOf([inboxThread("t1")], [ATLAS]);
    const items = [...inbox, fix("a", 100), tool("t", 200)];

    expect(idsOf(deckOrderOf(items, none, noGates))).toEqual(["t", "a", "t1"]);
  });
});

describe("deckCountTextOf", () => {
  it("joins the position, the acts, the held nodes and the inbox", () => {
    expect(deckCountTextOf({ index: 0, total: 241, acts: 63, held: 12, inbox: 178 })).toBe(
      "1 of 241 waiting · 63 acts · 12 nodes wait · 178 inbox",
    );
  });

  it("drops the inbox part at 0 and names no waiting node", () => {
    expect(deckCountTextOf({ index: 2, total: 5, acts: 1, held: 0, inbox: 0 })).toBe(
      "3 of 5 waiting · 1 act · No node waits",
    );
  });
});

describe("waitingTextOf", () => {
  it("shows the UTC clock for an item of the same UTC day", () => {
    expect(waitingTextOf(NOW - 2 * HOUR_MS - 5 * 60_000, NOW)).toBe(
      "Waiting 2 h 5 min · since 08:55",
    );
  });

  it("shows the date for an earlier day", () => {
    const at = Date.UTC(2026, 4, 10, 9, 30, 0);

    expect(waitingTextOf(at, NOW)).toBe("Waiting 49 h 30 min · since 05-10 09:30");
  });

  it("says the age is unknown for a null time", () => {
    expect(waitingTextOf(null, NOW)).toBe("Waiting · age unknown");
  });
});

describe("heldOnTextOf", () => {
  it("answers the singular, the plural and null", () => {
    expect(heldOnTextOf(1)).toBe("1 node waits on this");
    expect(heldOnTextOf(3)).toBe("3 nodes wait on this");
    expect(heldOnTextOf(0)).toBeNull();
  });
});

describe("doneTextOf and DECK_GONE_TEXT", () => {
  it("names the settled subject and the items that wait", () => {
    expect(doneTextOf("Add retry", 1)).toBe("Done: Add retry · 1 item waits");
    expect(doneTextOf("Add retry", 4)).toBe("Done: Add retry · 4 items wait");
  });

  it("holds the gone text", () => {
    expect(DECK_GONE_TEXT).toBe("The selected item no longer waits.");
  });
});

describe("heldCountOf and isAct", () => {
  it("counts the distinct held node ids", () => {
    const held = new Map([
      ["a", ["n1", "n2"]],
      ["b", ["n2", "n3"]],
    ]);

    expect(heldCountOf([fix("a", 1), fix("b", 2), fix("c", 3)], held)).toBe(3);
  });

  it("treats an inbox item as no act", () => {
    const [inbox] = inboxItemsOf([inboxThread("t1")], [ATLAS]);

    expect(isAct(fix("a", 1))).toBe(true);
    expect(inbox === undefined ? true : isAct(inbox)).toBe(false);
  });
});

describe("deckSummaryOf", () => {
  it("names the deck item #1 in Start here, also when it has a lower board rank", () => {
    const held = new Map([["held", ["n1", "n2"]]]);
    const order = deckOrderOf([fix("held", 1, "Held fix"), tool("t", 2)], held, noGates);

    const summary = deckSummaryOf(order, { details, held, inbox: 0, readFault: false });

    expect(summary.long).toBe(
      "2 acts wait for you. 2 nodes wait on them. Start here: Approve t in Approve tool.",
    );
  });

  it("adds the Inbox sentence for an inbox count above 0", () => {
    const inbox = inboxItemsOf([inboxThread("t1")], [ATLAS]);
    const order = deckOrderOf([fix("a", 1, "Fix a"), ...inbox], none, noGates);

    const summary = deckSummaryOf(order, { details, held: none, inbox: 1, readFault: false });

    expect(summary.long).toBe(
      "1 act waits for you. 0 nodes wait on them. Start here: Fix a in Fix setup. 1 thread waits in Inbox.",
    );
  });
});

describe("deckTabsOf", () => {
  it("lists each tab with an item in the order of the board tabs", () => {
    const inbox = inboxItemsOf([inboxThread("t1")], [ATLAS]);
    const order = deckOrderOf([...inbox, fix("a", 1), fix("b", 2), tool("t", 3)], none, noGates);

    const tabs = deckTabsOf(order, details);

    expect(tabs.map((entry) => [entry.tab.id, entry.count])).toEqual([
      [BOARD_TAB.Tool, 1],
      [BOARD_TAB.Setup, 2],
      [BOARD_TAB.Inbox, 1],
    ]);
  });
});

describe("deckListOf", () => {
  const inbox = inboxItemsOf(
    [
      inboxThread("t1", {
        project_id: ORBIT.id,
        content: { author: "Mira", body: "Please look", url: "https://x", occurred_at: 100 },
      }),
    ],
    [ATLAS, ORBIT],
  );
  const order = deckOrderOf(
    [tool("t", 1), fix("a", 2, "Alpha fix"), fix("b", 3, "Beta fix", ORBIT), ...inbox],
    none,
    noGates,
  );

  it("filters by tab and keeps the deck rank", () => {
    const list = deckListOf(order, details, { query: "", tab: BOARD_TAB.Setup, shown: 10 });

    expect(list.count).toBe(2);
    expect(list.rows.map((row) => [row.item.id, row.rank])).toEqual([
      ["a", 2],
      ["b", 3],
    ]);
  });

  it("finds a row by the subject, the cause, the Inbox author and a project name", () => {
    const find = (query: string) =>
      idsOf(
        deckListOf(order, details, { query, tab: null, shown: 10 }).rows.map((row) => row.item),
      );

    expect(find("  BETA ")).toEqual(["b"]);
    expect(find("waits for approval")).toEqual(["t"]);
    expect(find("mira")).toEqual(["t1"]);
    expect(find("orbit")).toEqual(["b", "t1"]);
  });

  it("answers at most shown rows and the match count", () => {
    const list = deckListOf(order, details, { query: "", tab: null, shown: 2 });

    expect(list.rows.map((row) => row.rank)).toEqual([1, 2]);
    expect(list.count).toBe(4);
  });
});
