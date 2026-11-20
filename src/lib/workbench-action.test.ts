import { describe, expect, it } from "vitest";

import type { WorkbenchActionOffer } from "@/api/types";
import {
  actionFactsOf,
  actionVerbOf,
  isDangerOperation,
  nodeChangeLineOf,
  projectChangeLineOf,
  readFailureLineOf,
  revisionChangeLineOf,
} from "./workbench-action";
import { ACTION_VERBS } from "./workbench-chat";

function offer(
  operationId: string,
  seen: WorkbenchActionOffer["seen"],
  targetId = "node_42",
): WorkbenchActionOffer {
  return {
    kind: "action_offer",
    tool_call_id: "call_1",
    operation_id: operationId,
    target_id: targetId,
    seen,
  };
}

describe("actionVerbOf", () => {
  it.each(Object.entries(ACTION_VERBS))("answers the verb of %s", (id, verb) => {
    expect(actionVerbOf(id)).toBe(verb);
  });

  it.each(["mission.node.explode", "toString", "constructor", ""])(
    "answers null for the id %j",
    (id) => {
      expect(actionVerbOf(id)).toBeNull();
    },
  );
});

describe("actionFactsOf", () => {
  it("lists the node and its seen state and attempt", () => {
    expect(
      actionFactsOf(
        offer("mission.node.discard", {
          name: "Add retry to payment client",
          state: "Blocked",
          attempt: 2,
        }),
      ),
    ).toEqual(["node: Add retry to payment client (node_42)", "state: Blocked · attempt 2"]);
  });

  it("lists the credential name and the revision of a credential offer", () => {
    expect(
      actionFactsOf(
        offer("llm.credential.rotate", { name: "codex-main", revision: 3 }, "codex-main"),
      ),
    ).toEqual(["credential: codex-main, revision 3"]);
  });

  it("lists the revision only for a credential offer with no name", () => {
    expect(actionFactsOf(offer("llm.credential.rotate", { revision: 3 }, "codex-main"))).toEqual([
      "revision 3",
    ]);
  });

  it("keeps Offered at revision for the agent enablement offer", () => {
    expect(actionFactsOf(offer("agent.enablement.put", { revision: 4 }, "ops@1"))).toEqual([
      "Offered at revision 4",
    ]);
  });

  it.each([
    [true, "state: paused"],
    [false, "state: active"],
  ])("lists the project and its state for paused %s", (paused, line) => {
    expect(
      actionFactsOf(offer("project.resume", { name: "Billing", paused }, "project_7")),
    ).toEqual(["project: Billing (project_7)", line]);
  });
});

describe("isDangerOperation", () => {
  it.each(["mission.node.discard", "mission.node.override"])("holds %s", (id) => {
    expect(isDangerOperation(id)).toBe(true);
  });

  it.each(["mission.node.resume", "mission.node.pause", "project.pause", "unknown"])(
    "does not hold %s",
    (id) => {
      expect(isDangerOperation(id)).toBe(false);
    },
  );
});

describe("nodeChangeLineOf", () => {
  const seen = offer("mission.node.discard", {
    name: "Add retry to payment client",
    state: "Blocked",
    attempt: 2,
  });

  it("answers null when the state and the attempt match", () => {
    expect(nodeChangeLineOf(seen, { state: "Blocked", attempt: 2 })).toBeNull();
  });

  it("names the read state when the state differs", () => {
    expect(nodeChangeLineOf(seen, { state: "Executing", attempt: 2 })).toBe(
      "node_42 changed since the card: it is now Executing (attempt 2). Nothing ran.",
    );
  });

  it("names the read attempt when only the attempt differs", () => {
    expect(nodeChangeLineOf(seen, { state: "Blocked", attempt: 3 })).toBe(
      "node_42 changed since the card: it is now Blocked (attempt 3). Nothing ran.",
    );
  });

  it("reports a change when the offer holds no node state", () => {
    const projectSeen = offer("mission.node.discard", { name: "Billing", paused: true });

    expect(nodeChangeLineOf(projectSeen, { state: "Blocked", attempt: 2 })).toBe(
      "node_42 changed since the card: it is now Blocked (attempt 2). Nothing ran.",
    );
  });
});

describe("projectChangeLineOf", () => {
  const seenPaused = offer("project.resume", { name: "Billing", paused: true }, "prj-1");

  it("answers null when the pause matches", () => {
    expect(projectChangeLineOf(seenPaused, { paused_at: 5 })).toBeNull();
  });

  it("names the active state when the project resumed", () => {
    expect(projectChangeLineOf(seenPaused, { paused_at: null })).toBe(
      "prj-1 changed since the card: it is now active. Nothing ran.",
    );
  });

  it("names the paused state when the project paused", () => {
    const seenActive = offer("project.pause", { name: "Billing", paused: false }, "prj-1");

    expect(projectChangeLineOf(seenActive, { paused_at: 5 })).toBe(
      "prj-1 changed since the card: it is now paused. Nothing ran.",
    );
  });
});

describe("readFailureLineOf", () => {
  it("names the target and the read failure", () => {
    expect(
      readFailureLineOf(offer("mission.node.discard", { name: "Billing", paused: true }), "Down."),
    ).toBe("node_42 was not read: Down.");
  });
});

describe("revisionChangeLineOf", () => {
  it("compares the revision only when the credential offer holds a name", () => {
    const seen = offer("llm.credential.rotate", { name: "codex-main", revision: 3 }, "codex-main");

    expect(revisionChangeLineOf(seen, 3)).toBeNull();
    expect(revisionChangeLineOf(seen, 4)).toBe(
      "codex-main changed since the card: it is now revision 4. Nothing ran.",
    );
  });
});
