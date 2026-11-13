import { describe, expect, it } from "vitest";

import type { WorkbenchActionOffer } from "@/api/types";
import { actionFactsOf, actionVerbOf, isDangerOperation } from "./workbench-action";
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
