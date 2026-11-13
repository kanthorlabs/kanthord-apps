import { describe, expect, it } from "vitest";

import type { WorkbenchActionOffer } from "@/api/types";
import {
  actionFactsOf,
  actionVerbOf,
  isDangerOperation,
  nodeChangeLineOf,
  projectChangeLineOf,
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
    expect(actionFactsOf(offer("mission.node.discard", { state: "Blocked", attempt: 2 }))).toEqual([
      "node: node_42",
      "state: Blocked · attempt 2",
    ]);
  });

  it.each([
    [true, "state: paused"],
    [false, "state: active"],
  ])("lists the project and its state for paused %s", (paused, line) => {
    expect(actionFactsOf(offer("project.resume", { paused }, "project_7"))).toEqual([
      "project: project_7",
      line,
    ]);
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
  const seen = offer("mission.node.discard", { state: "Blocked", attempt: 2 });

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
    const projectSeen = offer("mission.node.discard", { paused: true });

    expect(nodeChangeLineOf(projectSeen, { state: "Blocked", attempt: 2 })).toBe(
      "node_42 changed since the card: it is now Blocked (attempt 2). Nothing ran.",
    );
  });
});

describe("projectChangeLineOf", () => {
  const seenPaused = offer("project.resume", { paused: true }, "prj-1");

  it("answers null when the pause matches", () => {
    expect(projectChangeLineOf(seenPaused, { paused_at: 5 })).toBeNull();
  });

  it("names the active state when the project resumed", () => {
    expect(projectChangeLineOf(seenPaused, { paused_at: null })).toBe(
      "prj-1 changed since the card: it is now active. Nothing ran.",
    );
  });

  it("names the paused state when the project paused", () => {
    const seenActive = offer("project.pause", { paused: false }, "prj-1");

    expect(projectChangeLineOf(seenActive, { paused_at: 5 })).toBe(
      "prj-1 changed since the card: it is now paused. Nothing ran.",
    );
  });
});
