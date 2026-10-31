import { describe, expect, it } from "vitest";

import type {
  MissionAssessmentResult,
  MissionEvidence,
  MissionExternalAction,
  MissionNodeRecord,
  MissionProposal,
  NodeState,
  Project,
  WorkbenchSessionListItem,
} from "@/api/types";

import {
  type AttentionDetail,
  type AttentionDetails,
  type BlockedDetail,
  deriveAttention,
  detailKeyOf,
  type ProjectSnapshot,
} from "./attention";
import { BOARD_TAB, BOARD_TABS, boardTabOf } from "./board-tabs";

const NOW = 10_000_000;

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function node(
  id: string,
  state: NodeState,
  overrides: Partial<MissionNodeRecord> = {},
): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: `Node ${id}`,
      requirement: "",
      criterion: "",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    intent: "implement",
    tags: [],
    tasks: [],
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
    ...overrides,
  };
}

function blocked(id: string, overrides: Partial<MissionNodeRecord> = {}): MissionNodeRecord {
  const result: MissionAssessmentResult = "criterion-not-met";
  return node(id, "Blocked", {
    blocked_context: {
      outcome: {
        id: `outcome_${id}`,
        node_id: id,
        attempt: 2,
        node_revision: 1,
        closing_event: "assessment-not-passed",
        result,
        assessment_id: `assessment_${id}`,
        evidence_ids: [],
        created_at: 100,
      },
      requests: [],
    },
    ...overrides,
  });
}

function snapshot(nodes: readonly MissionNodeRecord[], project = PROJECT): ProjectSnapshot {
  return {
    project,
    missionVersion: 1,
    nodes,
    jobs: null,
    registrations: null,
    executions: null,
    bindings: null,
    environments: null,
  };
}

function derive(
  snapshots: readonly ProjectSnapshot[],
  details: AttentionDetails = new Map(),
  sessions: readonly WorkbenchSessionListItem[] | null = null,
) {
  return deriveAttention(snapshots, details, {
    now: NOW,
    catalog: null,
    credentials: [],
    sessions,
  });
}

function proposal(nodeId: string, overrides: Partial<MissionProposal> = {}): MissionProposal {
  return {
    id: `proposal_${nodeId}`,
    node_id: nodeId,
    attempt: 2,
    assessment_id: "assessment_1",
    content: {
      dependency_id: nodeId,
      name: "Extra",
      requirement: "",
      criterion: "",
      task: { name: "Extra", requirement: "", criterion: "", verifications: [] },
    },
    created_node_id: null,
    approved_at: null,
    rejected_at: null,
    created_at: 1,
    ...overrides,
  };
}

function blockedDetail(
  target: MissionNodeRecord,
  proposals: BlockedDetail["proposals"],
): AttentionDetails {
  return new Map<string, AttentionDetail>([
    [
      target.id,
      {
        kind: "blocked",
        key: detailKeyOf(target),
        assessment: { status: "ready", data: null },
        proposals,
      },
    ],
  ]);
}

function onlyItem(items: ReturnType<typeof derive>) {
  const [item] = items;
  if (item === undefined) throw new Error("No item.");
  return item;
}

describe("BOARD_TABS", () => {
  it("lists the six tabs in order with their keys", () => {
    expect(BOARD_TABS.map((tab) => [tab.id, tab.name, tab.short, tab.key])).toEqual([
      ["tool", "Approve tool", "Tool", "1"],
      ["setup", "Fix setup", "Setup", "2"],
      ["paused", "Resume", "Resume", "3"],
      ["proposal", "Decide proposal", "Decide", "4"],
      ["blocked", "Rule", "Rule", "5"],
      ["outside", "Act outside", "Outside", "6"],
    ]);
  });

  it("states the verb and the reason of each tab", () => {
    expect(BOARD_TABS.map((tab) => [tab.verb, tab.what])).toEqual([
      ["Approve or reject.", "A live agent run waits for the answer."],
      [
        "Change the setup.",
        "Workers cannot progress until you change a credential, an environment, a binding, an agent or a paused project.",
      ],
      [
        "Resume or discard.",
        "A node is Paused at a limit or by a human. A resume lets the node run again.",
      ],
      ["Decide the proposals.", "A reviewer proposes a new node. You decide."],
      [
        "Act on the stopped node.",
        "A node stops until you act: a closed attempt or a discarded dependency.",
      ],
      ["Act on the platform.", "KanthorD waits for an act outside, for example a merge."],
    ]);
  });

  it("names the tab ids", () => {
    expect(BOARD_TAB).toEqual({
      Tool: "tool",
      Setup: "setup",
      Resume: "paused",
      Proposal: "proposal",
      Rule: "blocked",
      Outside: "outside",
    });
  });
});

describe("boardTabOf", () => {
  it("answers tool for a tool approval", () => {
    const session: WorkbenchSessionListItem = {
      id: "s1",
      agent_name: "swe@1",
      name: null,
      created: 1,
      modified: 2,
      message_count: 1,
      first_message: "Create",
      run_active: true,
      pending_approval: { tool_call_id: "c1", operation_id: "project.create" },
    };

    const item = onlyItem(derive([], new Map(), [session]));

    expect(boardTabOf(item, new Map())).toBe(BOARD_TAB.Tool);
  });

  it("answers setup for a fix kind", () => {
    const item = onlyItem(derive([snapshot([node("a", "Pending")], { ...PROJECT, paused_at: 5 })]));

    expect(item.kind).toBe("project_paused");
    expect(boardTabOf(item, new Map())).toBe(BOARD_TAB.Setup);
  });

  it("answers paused for a paused node", () => {
    const item = onlyItem(derive([snapshot([node("a", "Paused")])]));

    expect(boardTabOf(item, new Map())).toBe(BOARD_TAB.Resume);
  });

  it("answers blocked for a blocked node that is not an examine node", () => {
    const item = onlyItem(derive([snapshot([blocked("a")])]));

    expect(boardTabOf(item, new Map())).toBe(BOARD_TAB.Rule);
  });

  it("answers blocked for a discarded dependency", () => {
    const item = onlyItem(
      derive([snapshot([node("a", "Pending", { depends_on: ["b"] }), node("b", "Discarded")])]),
    );

    expect(item.kind).toBe("dependency_discarded");
    expect(boardTabOf(item, new Map())).toBe(BOARD_TAB.Rule);
  });

  describe("a blocked examine node", () => {
    const examine = blocked("e", { intent: "examine" });

    function tabWith(details: AttentionDetails) {
      return boardTabOf(onlyItem(derive([snapshot([examine])], details)), details);
    }

    it("answers proposal before its proposals read answers", () => {
      expect(tabWith(new Map())).toBe(BOARD_TAB.Proposal);
    });

    it("answers proposal when the proposals read failed", () => {
      expect(tabWith(blockedDetail(examine, { status: "failed", message: "down" }))).toBe(
        BOARD_TAB.Proposal,
      );
    });

    it("answers proposal when one proposal is open", () => {
      expect(tabWith(blockedDetail(examine, { status: "ready", data: [proposal("e")] }))).toBe(
        BOARD_TAB.Proposal,
      );
    });

    it("answers blocked when the read holds no open proposal", () => {
      const decided = proposal("e", { approved_at: 5 });

      expect(tabWith(blockedDetail(examine, { status: "ready", data: [] }))).toBe(BOARD_TAB.Rule);
      expect(tabWith(blockedDetail(examine, { status: "ready", data: [decided] }))).toBe(
        BOARD_TAB.Rule,
      );
    });
  });

  describe("an outside item", () => {
    const requested = node("n1", "External.Requested");

    function request(action: "pull_request" | "merge_push"): MissionExternalAction {
      return {
        node_id: "n1",
        attempt: 2,
        action: {
          key: `repo.${action}`,
          binding_id: "binding_1",
          action,
          expected_end_state:
            action === "pull_request" ? "pull_request_merged" : "base_branch_pushed",
          follows: null,
          configuration: { base_branch: "main", landing: "human" },
        },
        requested: true,
        request_evidence_id: "evidence_1",
        resolution: "unresolved",
      };
    }

    function detailOf(
      action: MissionExternalAction,
      evidence: readonly MissionEvidence[],
    ): AttentionDetails {
      return new Map<string, AttentionDetail>([
        [
          "n1",
          {
            kind: "external",
            key: detailKeyOf(requested),
            actions: { status: "ready", data: [action] },
            evidence: { status: "ready", data: evidence },
            refreshFault: null,
          },
        ],
      ]);
    }

    it("answers outside for a merge wait", () => {
      const details = detailOf(request("pull_request"), []);

      const item = onlyItem(derive([snapshot([requested])], details));

      expect(item.kind).toBe("merge_wait");
      expect(boardTabOf(item, details)).toBe(BOARD_TAB.Outside);
    });

    it("answers outside for an unconfirmed delivery", () => {
      const old: MissionEvidence = {
        id: "evidence_1",
        node_id: "n1",
        attempt: 2,
        subject: "Request",
        assets: [],
        provenance: { kind: "human", account: "a", name: "A" },
        created_at: 1,
      };
      const details = detailOf(request("merge_push"), [old]);

      const item = onlyItem(derive([snapshot([requested])], details));

      expect(item.kind).toBe("delivery_unconfirmed");
      expect(boardTabOf(item, details)).toBe(BOARD_TAB.Outside);
    });
  });
});
