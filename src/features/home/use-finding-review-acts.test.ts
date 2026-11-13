import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  decideFinding,
  listNodeAssessments,
  listNodeEvidence,
  listNodeOutcomes,
  listNodeRevisions,
} from "@/api/resources/mission";
import type { MissionFinding, MissionNodeRecord, Project } from "@/api/types";
import type { FindingReviewItem } from "@/lib/attention";

import { useFindingReviewActs } from "./use-finding-review-acts";

vi.mock("@/api/resources/mission", () => ({
  createFinding: vi.fn(),
  decideFinding: vi.fn(),
  listNodeAssessments: vi.fn(),
  listNodeEvidence: vi.fn(),
  listNodeOutcomes: vi.fn(),
  listNodeRevisions: vi.fn(),
  updateFinding: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

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

const PROJECT = { id: "prj-1", name: "atlas" } as Project;
const NODE = { id: "node_1", content: { name: "Sign-up form" } } as MissionNodeRecord;
const REVIEW = missionFinding({ id: "f1", node_id: "node_1" });
const HUMAN = missionFinding({ id: "f2", node_id: "node_1", source: "human" });

const ITEM: FindingReviewItem = {
  id: "finding_review:node_1",
  kind: "finding_review",
  group: "decisions",
  project: PROJECT,
  subject: "Sign-up form",
  missionVersion: 7,
  node: NODE,
  nodes: [NODE],
  at: 1,
  cause: "Findings wait for a decision",
  findings: [REVIEW, HUMAN],
};

function renderActs() {
  const context = {
    reload: vi.fn(),
    setDialogOpen: vi.fn(),
    registerDialogCloser: vi.fn(),
  };
  const view = renderHook(() => useFindingReviewActs(ITEM, context));
  return { ...view, context };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listNodeAssessments).mockResolvedValue([]);
  vi.mocked(listNodeRevisions).mockResolvedValue([]);
  vi.mocked(listNodeOutcomes).mockResolvedValue([]);
  vi.mocked(listNodeEvidence).mockResolvedValue([]);
});

describe("useFindingReviewActs", () => {
  it("holds the board while the decision dialog is open and names no act at Cancel", () => {
    const { result, context } = renderActs();

    act(() => result.current.decision.request(REVIEW, "dismissed"));
    expect(context.setDialogOpen).toHaveBeenLastCalledWith("finding_review:node_1", "node_1", true);

    act(() => result.current.decision.cancel());
    expect(context.setDialogOpen).toHaveBeenLastCalledWith(
      "finding_review:node_1",
      "node_1",
      false,
      undefined,
    );
  });

  it("names the act at the close of a successful decision", async () => {
    vi.mocked(decideFinding).mockResolvedValue({ ...REVIEW, decision: "dismissed" });
    const { result, context } = renderActs();

    act(() => result.current.decision.request(REVIEW, "dismissed"));
    act(() => result.current.decision.setReason("No defect."));
    act(() => result.current.decision.confirm());

    await waitFor(() =>
      expect(context.setDialogOpen).toHaveBeenLastCalledWith(
        "finding_review:node_1",
        "node_1",
        false,
        { id: "decide_finding" },
      ),
    );
  });

  it("names no act at the close of the edit sheet", async () => {
    const { result, context } = renderActs();
    await waitFor(() => expect(listNodeRevisions).toHaveBeenCalled());

    act(() => result.current.report.requestEdit(HUMAN));
    expect(context.setDialogOpen).toHaveBeenLastCalledWith("finding_review:node_1", "node_1", true);

    act(() => result.current.report.cancel());
    expect(context.setDialogOpen).toHaveBeenLastCalledWith(
      "finding_review:node_1",
      "node_1",
      false,
      undefined,
    );
  });

  it("decides a finding and reloads the board", async () => {
    vi.mocked(decideFinding).mockResolvedValue({ ...REVIEW, decision: "accepted" });
    const { result, context } = renderActs();

    act(() => result.current.decision.request(REVIEW, "accepted"));
    act(() => result.current.decision.setReason("The next mission adds it."));
    act(() => result.current.decision.confirm());

    await waitFor(() => expect(context.reload).toHaveBeenCalled());
    expect(decideFinding).toHaveBeenCalledWith("f1", {
      decision: "accepted",
      decision_reason: "The next mission adds it.",
    });
  });

  it("registers a closer that cancels the open dialog", () => {
    const { result, context } = renderActs();
    act(() => result.current.decision.request(REVIEW, "accepted"));

    const close = context.registerDialogCloser.mock.calls.at(-1)?.[0] as () => void;
    act(() => close());

    expect(result.current.decision.open).toBe(false);
  });
});
