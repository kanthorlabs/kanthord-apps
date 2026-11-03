import { describe, expect, it } from "vitest";

import type {
  EnvironmentState,
  MissionFinding,
  MissionNodeRecord,
  MissionProposal,
} from "@/api/types";

import {
  type AttentionDetail,
  type AttentionDetails,
  type AttentionItem,
  type BlockedDetail,
  detailKeyOf,
} from "./attention";
import type { EvidenceLine } from "./board-evidence";
import {
  blockedDetailOf,
  boardFindingGroupsOf,
  boardSuggestionOf,
  discardReasonTextOf,
  environmentFailureOf,
  evidenceSettledOf,
  evidenceWindowOf,
  failureLimitOf,
  findingWhatTextOf,
  impactHeldTextOf,
  noCauseTextOf,
  showProposalsOf,
  spreadOf,
} from "./board-section-facts";

function missionFinding(overrides: Partial<MissionFinding> = {}): MissionFinding {
  const human = overrides.source === "human";
  return {
    id: "finding_1",
    node_id: "n1",
    attempt: 1,
    round: human ? null : 2,
    assessment_id: "assessment_1",
    source: "reviewer",
    label: human ? "H1" : "S1",
    kind: "suggestion",
    action: "yes",
    task_id: null,
    ground: null,
    name: "Trim the email",
    description: "The form keeps the spaces around the email address.",
    fix: "Trim the email address before the check.",
    why: "A pasted address often holds a trailing space.",
    route: "report",
    status: "open",
    fixed_assessment_id: null,
    cause_owner: human ? "reviewer" : null,
    created_by: human ? { kind: "human", account: "ulrich", name: "Ulrich" } : null,
    created_at: 1,
    decision: null,
    decision_reason: null,
    decided_by: null,
    decided_at: null,
    ...overrides,
  };
}

function asItem(value: object): AttentionItem {
  return value as unknown as AttentionItem;
}

function lineOf(key: string): EvidenceLine {
  return { key, kind: "text", text: key, links: [], command: null };
}

function environmentOf(failure: object | null): EnvironmentState {
  return { binding_id: "b1", failure } as unknown as EnvironmentState;
}

const FAILED = asItem({ kind: "environment_failed", bindingId: "b1" });

describe("environmentFailureOf", () => {
  it("returns null for another kind of item", () => {
    expect(environmentFailureOf(asItem({ kind: "paused" }), [environmentOf(null)])).toBeNull();
  });

  it("returns null without the environments read", () => {
    expect(environmentFailureOf(FAILED, null)).toBeNull();
  });

  it("returns null when the binding holds no failure", () => {
    expect(environmentFailureOf(FAILED, [environmentOf(null)])).toBeNull();
  });

  it("reads the exit code of the failure of the binding", () => {
    const failure = { command: "make", exit_code: 2, reproduce: "make again" };
    expect(environmentFailureOf(FAILED, [environmentOf(failure)])).toEqual({
      command: "make",
      ended: " exited with 2.",
      reproduce: "make again",
    });
  });

  it("says the command did not finish without an exit code", () => {
    const failure = { command: "make", exit_code: null, reproduce: "make again" };
    expect(environmentFailureOf(FAILED, [environmentOf(failure)])?.ended).toBe(" did not finish.");
  });
});

describe("discardReasonTextOf", () => {
  const reasons = [
    { id: "a", reason: "Not needed" },
    { id: "b", reason: null },
  ];

  it("quotes the reason of the dependency", () => {
    expect(discardReasonTextOf(reasons, "a")).toBe('Reason: "Not needed"');
  });

  it("says no reason is recorded for a null reason", () => {
    expect(discardReasonTextOf(reasons, "b")).toBe("No reason is recorded.");
  });

  it("says no reason is recorded for an unknown dependency", () => {
    expect(discardReasonTextOf(reasons, "c")).toBe("No reason is recorded.");
  });
});

describe("evidenceWindowOf", () => {
  const lines = ["1", "2", "3", "4", "5"].map(lineOf);

  it("shows every line when the list is not collapsible", () => {
    expect(evidenceWindowOf(lines, false, false)).toEqual({ shown: lines, hidden: 0 });
  });

  it("shows the first three lines when the list is collapsed", () => {
    expect(evidenceWindowOf(lines, true, false)).toEqual({ shown: lines.slice(0, 3), hidden: 2 });
  });

  it("shows every line once the list is expanded", () => {
    expect(evidenceWindowOf(lines, true, true)).toEqual({ shown: lines, hidden: 0 });
  });

  it("hides nothing in a short list", () => {
    const short = lines.slice(0, 2);
    expect(evidenceWindowOf(short, true, false).shown).toEqual(short);
    expect(evidenceWindowOf(short, true, false).hidden).toBeLessThanOrEqual(0);
  });
});

describe("evidenceSettledOf", () => {
  it("settles an item that is not blocked", () => {
    expect(evidenceSettledOf(asItem({ kind: "paused" }), null)).toBe(true);
  });

  it("waits for the read of a blocked item", () => {
    const blocked = asItem({ kind: "blocked" });
    expect(evidenceSettledOf(blocked, null)).toBe(false);
    expect(evidenceSettledOf(blocked, { status: "failed" })).toBe(false);
    expect(evidenceSettledOf(blocked, { status: "ready" })).toBe(true);
  });
});

describe("failureLimitOf", () => {
  it("is true for a node paused at the failure limit", () => {
    expect(failureLimitOf(asItem({ kind: "paused", pause: { cause: "failure-limit" } }))).toBe(
      true,
    );
  });

  it("is false for another pause cause, no pause or another kind", () => {
    expect(failureLimitOf(asItem({ kind: "paused", pause: { cause: "human" } }))).toBe(false);
    expect(failureLimitOf(asItem({ kind: "paused", pause: null }))).toBe(false);
    expect(failureLimitOf(asItem({ kind: "blocked" }))).toBe(false);
  });
});

describe("impactHeldTextOf", () => {
  it("says no node waits for a count of zero", () => {
    expect(impactHeldTextOf(0)).toBe("No node waits on this card.");
  });

  it("gives the count in total", () => {
    expect(impactHeldTextOf(2)).toBe("2 nodes wait in total.");
  });
});

describe("noCauseTextOf", () => {
  it("names an undetermined assessment", () => {
    const item = asItem({
      kind: "blocked",
      node: { blocked_context: { outcome: { result: "undetermined" } } },
    });
    expect(noCauseTextOf(item)).toBe("No cause assigned: the assessment was undetermined.");
  });

  it("calls any other item a wait", () => {
    expect(noCauseTextOf(asItem({ kind: "paused" }))).toBe(
      "No cause: this is a wait, not a fault.",
    );
  });
});

describe("spreadOf", () => {
  it("returns null for an item outside the fixes group", () => {
    expect(spreadOf(asItem({ kind: "paused", group: "decisions" }))).toBeNull();
  });

  it("states the spread of a fix across projects", () => {
    const item = asItem({
      kind: "credential_refused",
      group: "fixes",
      count: 2,
      projectCount: 2,
    });
    expect(spreadOf(item)).toBe("2 nodes in 2 projects");
  });
});

describe("blockedDetailOf", () => {
  const node = { id: "n", attempt: 1, state: "Blocked" } as unknown as MissionNodeRecord;
  const blocked = asItem({ kind: "blocked", node });
  const detail = { kind: "blocked", key: detailKeyOf(node) } as unknown as BlockedDetail;

  it("returns null for an item that is not blocked", () => {
    expect(blockedDetailOf(asItem({ kind: "paused" }), new Map())).toBeNull();
  });

  it("returns null while the detail is unread", () => {
    expect(blockedDetailOf(blocked, new Map())).toBeNull();
  });

  it("returns the blocked detail of the node", () => {
    const details: AttentionDetails = new Map([[node.id, detail]]);
    expect(blockedDetailOf(blocked, details)).toBe(detail);
  });

  it("returns null for a detail of another kind", () => {
    const other = { kind: "paused", key: detailKeyOf(node) } as unknown as AttentionDetail;
    expect(blockedDetailOf(blocked, new Map([[node.id, other]]))).toBeNull();
  });
});

describe("showProposalsOf", () => {
  const proposal = { id: "p" } as unknown as MissionProposal;
  const failedRead = { proposals: { status: "failed", message: "x" } } as unknown as BlockedDetail;
  const blocked = asItem({ kind: "blocked" });

  it("is false for an item that is not blocked", () => {
    expect(showProposalsOf(asItem({ kind: "paused" }), [proposal], null)).toBe(false);
  });

  it("is true for a blocked item with proposals", () => {
    expect(showProposalsOf(blocked, [proposal], null)).toBe(true);
  });

  it("is true for a blocked item whose proposals read failed", () => {
    expect(showProposalsOf(blocked, [], failedRead)).toBe(true);
  });

  it("is false for a blocked item with no proposal and no failed read", () => {
    expect(showProposalsOf(blocked, [], null)).toBe(false);
  });
});

describe("boardSuggestionOf", () => {
  it("suggests the unblock of a blocked item without proposals", () => {
    const suggestion = boardSuggestionOf(asItem({ kind: "blocked" }), null, [], null);
    expect(suggestion.text).toContain("Unblock from the node branch");
  });

  it("names the reviewer of the ready assessment", () => {
    const proposal = { content: { name: "Plan" } } as unknown as MissionProposal;
    const detail = {
      kind: "blocked",
      assessment: {
        status: "ready",
        data: { actor: { kind: "human", name: "ulrich" } },
      },
      proposals: { status: "ready", data: [] },
    } as unknown as BlockedDetail;
    const suggestion = boardSuggestionOf(asItem({ kind: "blocked" }), null, [proposal], detail);
    expect(suggestion.text).toBe('Decide the proposals: check "Plan".');
  });
});

describe("boardFindingGroupsOf", () => {
  it("groups the findings by attempt and round, blockers first, then by the label number", () => {
    const groups = boardFindingGroupsOf([
      missionFinding({ id: "f5", attempt: 2, round: 1, label: "S1" }),
      missionFinding({ id: "f4", source: "human", attempt: 1, round: null, label: "H1" }),
      missionFinding({ id: "f3", attempt: 1, round: 2, label: "S10" }),
      missionFinding({ id: "f2", attempt: 1, round: 2, label: "S2" }),
      missionFinding({ id: "f1", attempt: 1, round: 2, label: "B1", kind: "blocker" }),
    ]);

    expect(
      groups.map((group) => [group.title, group.findings.map((finding) => finding.id)]),
    ).toEqual([
      ["Attempt 1 · Round 2", ["f1", "f2", "f3"]],
      ["Attempt 1 · Found after delivery", ["f4"]],
      ["Attempt 2 · Round 1", ["f5"]],
    ]);
  });

  it("titles a human finding at attempt 0 as found after delivery", () => {
    const groups = boardFindingGroupsOf([
      missionFinding({ id: "f1", source: "human", attempt: 0, round: null }),
    ]);

    expect(groups.map((group) => group.title)).toEqual(["Attempt 0 · Found after delivery"]);
  });
});

describe("findingWhatTextOf", () => {
  it("counts the findings that wait", () => {
    expect(findingWhatTextOf([missionFinding()])).toBe(
      "1 finding waits for your decision. KanthorD fixes none of them. Accept or dismiss each finding.",
    );
  });
});
