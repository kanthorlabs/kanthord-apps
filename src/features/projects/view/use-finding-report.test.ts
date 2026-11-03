import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import {
  createFinding,
  listNodeAssessments,
  listNodeRevisions,
  updateFinding,
} from "@/api/resources/mission";
import type { MissionAssessment, MissionFinding, MissionRevision } from "@/api/types";
import { useFindingReport } from "./use-finding-report";

vi.mock("@/api/resources/mission", () => ({
  createFinding: vi.fn(),
  listNodeAssessments: vi.fn(),
  listNodeRevisions: vi.fn(),
  updateFinding: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const ACTOR = { kind: "human" as const, account: "ulrich", name: "Ulrich" };

function assessment(
  id: string,
  revision: number,
  executionId: string | null = `execution_${id}`,
  nodeId = "node_signup",
): MissionAssessment {
  return {
    id,
    node_id: nodeId,
    execution_id: executionId,
    attempt: 1,
    node_revision: revision,
    evidence_ids: [],
    dependency_outcome_ids: [],
    result: "success",
    rationale: "r",
    tested_input: null,
    actor: ACTOR,
    created_at: 0,
    currency: null,
    dependency_node_ids: [],
    worker_version: null,
    round: null,
  };
}

function revision(number: number, taskIds: readonly string[]): MissionRevision {
  return {
    node_id: "node_signup",
    filename: "signup.md",
    revision: number,
    reason: "r",
    actor: ACTOR,
    created_at: 0,
    content: {
      name: "Sign-up form",
      requirement: "r",
      criterion: "c",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    tasks: taskIds.map((id) => ({
      id,
      filename: `${id}.md`,
      content: {
        name: `Task ${id}`,
        requirement: "r",
        criterion: "c",
        verifications: [],
        bindings: [],
      },
    })),
    change: { write: "import", previous_revision: null, changed_fields: [] },
    pinned_by_attempts: [],
  };
}

const HUMAN_FINDING: MissionFinding = {
  id: "finding_h1",
  node_id: "node_signup",
  attempt: 1,
  round: null,
  assessment_id: "assessment_2",
  source: "human",
  label: "H1",
  kind: "blocker",
  action: "yes",
  task_id: "task_b",
  ground: null,
  name: "Duplicate account",
  description: "A case change creates a second account.",
  fix: "Compare without case.",
  why: "One person owns two accounts.",
  route: "report",
  status: "open",
  fixed_assessment_id: null,
  cause_owner: "reviewer",
  created_by: ACTOR,
  created_at: 0,
  decision: null,
  decision_reason: null,
  decided_by: null,
  decided_at: null,
};

async function mount(reload = vi.fn()) {
  const view = renderHook(() => useFindingReport("node_signup", 7, reload));
  await waitFor(() => expect(view.result.current.available).toBe(true));
  return { ...view, reload };
}

function fill(result: { current: ReturnType<typeof useFindingReport> }) {
  act(() => result.current.setField("name", "Duplicate account"));
  act(() => result.current.setField("description", "A case change creates a second account."));
  act(() => result.current.setField("fix", "Compare without case."));
  act(() => result.current.setField("why", "One person owns two accounts."));
  act(() => result.current.setField("cause_owner", "reviewer"));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listNodeAssessments).mockResolvedValue([
    assessment("assessment_1", 1),
    assessment("assessment_override", 1, null),
    assessment("assessment_2", 2),
    assessment("assessment_other", 1, "execution_other", "node_other"),
  ]);
  vi.mocked(listNodeRevisions).mockResolvedValue([
    revision(2, ["task_b"]),
    revision(1, ["task_a"]),
  ]);
  vi.mocked(createFinding).mockResolvedValue(HUMAN_FINDING);
  vi.mocked(updateFinding).mockResolvedValue(HUMAN_FINDING);
});

describe("useFindingReport", () => {
  it("offers no report for a node with no assessment", async () => {
    vi.mocked(listNodeAssessments).mockResolvedValue([]);
    const { result } = renderHook(() => useFindingReport("node_signup", 7, vi.fn()));

    await waitFor(() =>
      expect(result.current.unavailableReason).toBe(
        "The node holds no assessment. A defect report names the assessment that missed the defect.",
      ),
    );
    act(() => result.current.requestCreate());
    expect(result.current.open).toBe(false);
  });

  it("starts a report on the latest assessment with the tasks of its revision", async () => {
    const { result } = await mount();

    act(() => result.current.requestCreate());

    expect(result.current.draft.assessment_id).toBe("assessment_2");
    expect(result.current.assessmentChoices.map((item) => item.id)).toEqual([
      "assessment_1",
      "assessment_override",
      "assessment_2",
    ]);
    expect(result.current.tasks.map((task) => task.id)).toEqual(["task_b"]);
    act(() => result.current.setField("assessment_id", "assessment_1"));
    expect(result.current.tasks.map((task) => task.id)).toEqual(["task_a"]);
  });

  it("refuses an incomplete draft before the call", async () => {
    const { result } = await mount();

    act(() => result.current.requestCreate());
    act(() => result.current.save());

    expect(createFinding).not.toHaveBeenCalled();
    expect(result.current.errors).toMatchObject({
      name: "Write the text.",
      cause_owner: "Choose the owner of the cause.",
    });
  });

  it("creates the finding with the mission version and the report fields", async () => {
    const { result, reload } = await mount();

    act(() => result.current.requestCreate());
    fill(result);
    act(() => result.current.setField("task", "task_b"));
    await act(async () => result.current.save());

    expect(createFinding).toHaveBeenCalledWith("node_signup", {
      expected_mission_version: 7,
      assessment_id: "assessment_2",
      kind: "blocker",
      task_id: "task_b",
      name: "Duplicate account",
      description: "A case change creates a second account.",
      fix: "Compare without case.",
      why: "One person owns two accounts.",
      cause_owner: "reviewer",
    });
    expect(result.current.open).toBe(false);
    expect(result.current.refreshKey).toBe(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Reported the defect H1.");
  });

  it("updates a human finding with the edited fields", async () => {
    const { result } = await mount();

    act(() => result.current.requestEdit(HUMAN_FINDING));
    act(() => result.current.setField("cause_owner", "plan"));
    await act(async () => result.current.save());

    expect(updateFinding).toHaveBeenCalledWith("finding_h1", {
      expected_mission_version: 7,
      kind: "blocker",
      task_id: "task_b",
      name: "Duplicate account",
      description: "A case change creates a second account.",
      fix: "Compare without case.",
      why: "One person owns two accounts.",
      cause_owner: "plan",
    });
    expect(createFinding).not.toHaveBeenCalled();
  });

  it("refuses an assessment of another node on create before the call", async () => {
    const { result } = await mount();

    act(() => result.current.requestCreate());
    fill(result);
    act(() => result.current.setField("assessment_id", "assessment_other"));
    act(() => result.current.save());

    expect(createFinding).not.toHaveBeenCalled();
    expect(result.current.errors.assessment_id).toBe("Choose an assessment of this node.");
  });

  it("maps a refused assessment of the daemon to the assessment field", async () => {
    vi.mocked(createFinding).mockRejectedValue(
      new ApiError(
        "malformed",
        "Request validation failed.",
        400,
        "gateway.request.validation_failed",
        [{ path: ["assessment_id"], code: "custom" }],
      ),
    );
    const { result } = await mount();

    act(() => result.current.requestCreate());
    fill(result);
    await act(async () => result.current.save());

    expect(result.current.errors.assessment_id).toBe(
      "The daemon refused the assessment. Choose an assessment of this node.",
    );
    expect(result.current.open).toBe(true);
  });

  it("reads the assessments again after a save and after a mission version change", async () => {
    const view = renderHook(
      ({ version }: { version: number }) => useFindingReport("node_signup", version, vi.fn()),
      { initialProps: { version: 7 } },
    );
    await waitFor(() => expect(view.result.current.available).toBe(true));
    expect(listNodeAssessments).toHaveBeenCalledTimes(1);

    act(() => view.result.current.requestCreate());
    fill(view.result);
    await act(async () => view.result.current.save());
    await waitFor(() => expect(listNodeAssessments).toHaveBeenCalledTimes(2));

    view.rerender({ version: 8 });
    await waitFor(() => expect(listNodeAssessments).toHaveBeenCalledTimes(3));
    expect(listNodeRevisions).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["mission.version.conflict", "The mission changed after this read."],
    ["mission.finding.not_human", "The finding is a reviewer finding."],
    ["mission.finding.decided", "A decided finding takes no edit."],
  ])("maps the refusal %s to a message and reloads", async (code, message) => {
    vi.mocked(updateFinding).mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = await mount();

    act(() => result.current.requestEdit(HUMAN_FINDING));
    await act(async () => result.current.save());

    expect(result.current.error).toContain(message);
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Updating the finding failed.", {
      description: expect.stringContaining(message),
    });
  });
});
