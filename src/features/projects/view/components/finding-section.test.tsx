import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import type { MissionAssessment, MissionFinding, MissionTaskContent } from "@/api/types";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { FindingSection } from "./finding-section";

const HUMAN = { kind: "human" as const, account: "ulrich", name: "Ulrich" };

function finding(
  id: string,
  round: number | null,
  label: string,
  extra: Partial<MissionFinding> = {},
): MissionFinding {
  return {
    id,
    node_id: "node_signup",
    attempt: 1,
    round,
    assessment_id: `assessment_${round ?? 3}`,
    source: "reviewer",
    label,
    kind: label.startsWith("B") ? "blocker" : "suggestion",
    action: "yes",
    task_id: null,
    ground: label.startsWith("B") ? "stated" : null,
    name: `Name of ${label} in round ${round ?? "none"}`,
    description: `Description of ${label}`,
    fix: `Fix of ${label}`,
    why: `Why of ${label}`,
    route: "fix",
    status: "open",
    fixed_assessment_id: null,
    cause_owner: null,
    created_by: null,
    created_at: 0,
    decision: null,
    decision_reason: null,
    decided_by: null,
    decided_at: null,
    ...extra,
  };
}

const ASSESSMENT_3: MissionAssessment = {
  id: "assessment_3",
  node_id: "node_signup",
  execution_id: "execution_3",
  attempt: 1,
  node_revision: 1,
  evidence_ids: [],
  dependency_outcome_ids: [],
  result: "success",
  rationale: "The form meets the criterion.",
  tested_input: null,
  actor: { kind: "execution", execution_id: "execution_3", client_id: null, name: "reviewer" },
  created_at: 0,
  currency: null,
  dependency_node_ids: [],
  worker_version: "reviewer@1",
  round: 3,
};

const TASKS: readonly MissionTaskContent[] = [
  {
    id: "task_email",
    filename: "email.md",
    content: {
      name: "Check the email",
      requirement: "r",
      criterion: "c",
      verifications: [],
      bindings: [],
    },
  },
];

const FINDINGS: readonly MissionFinding[] = [
  finding("finding_b1", 1, "B1", { status: "fixed", fixed_assessment_id: "assessment_2" }),
  finding("finding_s1", 1, "S1", { task_id: "task_email" }),
  finding("finding_s3", 1, "S3", { action: "no", route: "record" }),
  finding("finding_r3s1", 3, "S1", {
    route: "report",
    decision: "accepted",
    decision_reason: "A follow-up node adds it.",
    decided_by: HUMAN,
    decided_at: 1,
  }),
  finding("finding_r3s2", 3, "S2", { route: "report" }),
  finding("finding_h1", null, "H1", {
    source: "human",
    kind: "blocker",
    route: "report",
    cause_owner: "reviewer",
    created_by: HUMAN,
  }),
];

function mount(findings: readonly MissionFinding[] = FINDINGS, onEdit = vi.fn(), reload = vi.fn()) {
  render(
    <FindingSection
      findings={{ data: findings, error: null }}
      assessments={[ASSESSMENT_3]}
      tasks={TASKS}
      onEdit={onEdit}
      reload={reload}
    />,
  );
  return { onEdit, reload };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(missionApi.decideFinding).mockResolvedValue(FINDINGS[4] as MissionFinding);
});

describe("FindingSection", () => {
  it("groups the findings by round with the human findings last", () => {
    mount();

    const section = screen.getByRole("region", { name: "Findings" });
    const titles = within(section)
      .getAllByRole("list")
      .map((list) => list.getAttribute("aria-label"));
    expect(titles).toEqual(["Round 1", "Round 3 · report only", "Found after delivery"]);
  });

  it("keeps the order of the read inside a round", () => {
    mount();

    const round = screen.getByRole("list", { name: "Round 1" });
    expect(
      within(round)
        .getAllByRole("listitem")
        .map((item) => item.textContent?.slice(0, 2)),
    ).toEqual(["B1", "S1", "S3"]);
  });

  it("shows the kind, the action, the status, the route and the task of a finding", () => {
    mount();

    const round = screen.getByRole("list", { name: "Round 1" });
    const [blocker, suggestion, record] = within(round).getAllByRole("listitem");
    expect(within(blocker as HTMLElement).getByText("blocker")).toBeTruthy();
    expect(within(blocker as HTMLElement).getByText("fixed")).toBeTruthy();
    expect(within(blocker as HTMLElement).getByText("KanthorD fixes")).toBeTruthy();
    expect(within(suggestion as HTMLElement).getByText("Task: Check the email")).toBeTruthy();
    expect(within(suggestion as HTMLElement).getByText("open")).toBeTruthy();
    expect(within(record as HTMLElement).getByText("action: no")).toBeTruthy();
    expect(within(record as HTMLElement).getByText("Record")).toBeTruthy();
    expect(within(record as HTMLElement).getByText("Fix: Fix of S3")).toBeTruthy();
    expect(within(record as HTMLElement).getByText("Why: Why of S3")).toBeTruthy();
  });

  it("shows the decision of a decided finding and no decision actions", () => {
    mount();

    const round = screen.getByRole("list", { name: "Round 3 · report only" });
    const [decided, waiting] = within(round).getAllByRole("listitem");
    expect(
      within(decided as HTMLElement).getByText(
        "Accepted by Ulrich (ulrich): A follow-up node adds it.",
      ),
    ).toBeTruthy();
    expect(within(decided as HTMLElement).queryByRole("button", { name: /Accept/ })).toBeNull();
    expect(
      within(waiting as HTMLElement).getByRole("button", { name: "Accept the finding S2" }),
    ).toBeTruthy();
    expect(
      within(waiting as HTMLElement).getByRole("button", { name: "Dismiss the finding S2" }),
    ).toBeTruthy();
  });

  it("names the cause owner, the reporter and the missed assessment of a human finding", async () => {
    const { onEdit } = mount();

    const group = screen.getByRole("list", { name: "Found after delivery" });
    expect(within(group).getByText("H1")).toBeTruthy();
    expect(within(group).getByText("Cause owner: reviewer")).toBeTruthy();
    expect(
      within(group).getByText("Reported by Ulrich (ulrich), 1970-01-01 00:00 UTC"),
    ).toBeTruthy();
    expect(
      within(group).getByText(
        "Missed by the success assessment of round 3 by reviewer (execution_3)",
      ),
    ).toBeTruthy();
    await userEvent.click(within(group).getByRole("button", { name: "Edit the finding H1" }));
    expect(onEdit).toHaveBeenCalledWith(FINDINGS[5]);
  });

  it("labels a round report only from its own action items", () => {
    mount([
      finding("finding_a", 1, "B1", { route: "report" }),
      finding("finding_b", 2, "S1"),
      finding("finding_c", 3, "S1", { action: "no", route: "record" }),
    ]);

    expect(screen.getByRole("list", { name: "Round 1 · report only" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Round 2" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Round 3" })).toBeTruthy();
  });

  it("decides a finding with a required reason", async () => {
    const { reload } = mount();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss the finding S2" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Dismiss states that the finding is no defect./)).toBeTruthy();
    const confirm = within(dialog).getByRole("button", { name: "Dismiss" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Reason"), "No defect.");
    await userEvent.click(confirm);

    expect(missionApi.decideFinding).toHaveBeenCalledWith("finding_r3s2", {
      decision: "dismissed",
      decision_reason: "No defect.",
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows a refusal in the dialog and reloads", async () => {
    vi.mocked(missionApi.decideFinding).mockRejectedValue(
      new ApiError("conflict", "Conflict.", 409, "mission.finding.decided"),
    );
    const { reload } = mount();

    await userEvent.click(screen.getByRole("button", { name: "Accept the finding S2" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.type(within(dialog).getByLabelText("Reason"), "A follow-up adds it.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Accept" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Another decision of this finding came first. The view now shows it.",
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("states that no finding names the attempt", () => {
    mount([]);

    expect(screen.getByText("No review finding names this attempt.")).toBeTruthy();
  });
});
