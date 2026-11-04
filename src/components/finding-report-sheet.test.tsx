import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import type { MissionAssessment, MissionFinding, MissionRevision } from "@/api/types";
import { useFindingReport } from "@/hooks/use-finding-report";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { FindingReportSheet } from "./finding-report-sheet";

const ACTOR = { kind: "human" as const, account: "ulrich", name: "Ulrich" };

const ASSESSMENT: MissionAssessment = {
  id: "assessment_3",
  node_id: "node_signup",
  execution_id: "execution_3",
  attempt: 1,
  node_revision: 1,
  evidence_ids: [],
  dependency_outcome_ids: [],
  result: "success",
  rationale: "r",
  tested_input: null,
  actor: { kind: "execution", execution_id: "execution_3", client_id: null, name: "reviewer" },
  created_at: 0,
  currency: null,
  dependency_node_ids: [],
  worker_version: "reviewer@1",
  round: 3,
};

const REVISION: MissionRevision = {
  node_id: "node_signup",
  filename: "signup.md",
  revision: 1,
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
  tasks: [],
  change: { write: "import", previous_revision: null, changed_fields: [] },
  pinned_by_attempts: [],
};

const HUMAN_FINDING: MissionFinding = {
  id: "finding_h1",
  node_id: "node_signup",
  attempt: 1,
  round: null,
  assessment_id: "assessment_3",
  source: "human",
  label: "H1",
  kind: "blocker",
  action: "yes",
  task_id: null,
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

function Harness({ reload }: { reload: () => void }) {
  const report = useFindingReport("node_signup", 5, reload);
  return (
    <>
      <button type="button" disabled={!report.available} onClick={report.requestCreate}>
        Open the report
      </button>
      <button type="button" onClick={() => report.requestEdit(HUMAN_FINDING)}>
        Open the edit
      </button>
      <FindingReportSheet report={report} />
    </>
  );
}

async function mount(reload = vi.fn()) {
  render(<Harness reload={reload} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Open the report" })).toBeEnabled(),
  );
  return reload;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(missionApi.listNodeAssessments).mockResolvedValue([ASSESSMENT]);
  vi.mocked(missionApi.listNodeRevisions).mockResolvedValue([REVISION]);
  vi.mocked(missionApi.listNodeOutcomes).mockResolvedValue([
    {
      id: "outcome_3",
      node_id: "node_signup",
      attempt: 1,
      node_revision: 1,
      closing_event: "assessment-passed",
      result: "success",
      assessment_id: "assessment_3",
      evidence_ids: [],
      created_at: 0,
    },
  ]);
  vi.mocked(missionApi.listNodeEvidence).mockResolvedValue([]);
  vi.mocked(missionApi.createFinding).mockResolvedValue(HUMAN_FINDING);
  vi.mocked(missionApi.updateFinding).mockResolvedValue(HUMAN_FINDING);
});

describe("FindingReportSheet", () => {
  it("creates a human finding from the fields of the sheet", async () => {
    const reload = await mount();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Open the report" }));
    const sheet = await screen.findByRole("dialog", { name: "Report a defect" });
    expect(
      within(sheet).getByText("An assessment of an attempt that delivered the code."),
    ).toBeInTheDocument();
    await user.type(within(sheet).getByLabelText("Name"), "Duplicate account");
    await user.type(
      within(sheet).getByLabelText("Description"),
      "A case change creates a second account.",
    );
    await user.type(within(sheet).getByLabelText("Fix"), "Compare without case.");
    await user.type(within(sheet).getByLabelText("Why"), "One person owns two accounts.");
    await user.click(within(sheet).getByRole("combobox", { name: "Owner of the cause" }));
    await user.click(await screen.findByRole("option", { name: "reviewer" }));
    await user.click(within(sheet).getByRole("button", { name: "Report the defect" }));

    await waitFor(() =>
      expect(missionApi.createFinding).toHaveBeenCalledWith("node_signup", {
        expected_mission_version: 5,
        assessment_id: "assessment_3",
        kind: "blocker",
        task_id: null,
        name: "Duplicate account",
        description: "A case change creates a second account.",
        fix: "Compare without case.",
        why: "One person owns two accounts.",
        cause_owner: "reviewer",
      }),
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("names each missing field and sends nothing", async () => {
    await mount();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Open the report" }));
    const sheet = await screen.findByRole("dialog", { name: "Report a defect" });
    await user.click(within(sheet).getByRole("button", { name: "Report the defect" }));

    expect(within(sheet).getAllByText("Write the text.")).toHaveLength(4);
    expect(within(sheet).getByText("Choose the owner of the cause.")).toBeTruthy();
    expect(missionApi.createFinding).not.toHaveBeenCalled();
  });

  it("updates a human finding and shows its fixed assessment", async () => {
    await mount();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Open the edit" }));
    const sheet = await screen.findByRole("dialog", { name: "Edit the finding H1" });
    expect(
      within(sheet).getByText(
        "Assessment that missed it: Attempt 1, round 3: success by reviewer (execution_3)",
      ),
    ).toBeTruthy();
    const name = within(sheet).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Duplicate account on case change");
    await user.click(within(sheet).getByRole("button", { name: "Save the finding" }));

    await waitFor(() =>
      expect(missionApi.updateFinding).toHaveBeenCalledWith(
        "finding_h1",
        expect.objectContaining({
          expected_mission_version: 5,
          name: "Duplicate account on case change",
        }),
      ),
    );
    expect(missionApi.createFinding).not.toHaveBeenCalled();
  });

  it.each([
    [
      "mission.finding.not_human",
      "The finding is a reviewer finding. Only a human finding takes an edit. The view now shows the current findings.",
    ],
    [
      "mission.version.conflict",
      "The mission changed after this read. The view now shows the current mission. Save again.",
    ],
  ])("shows the refusal %s in the sheet and reloads", async (code, message) => {
    vi.mocked(missionApi.updateFinding).mockRejectedValue(
      new ApiError("conflict", "Conflict.", 409, code),
    );
    const reload = await mount();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Open the edit" }));
    const sheet = await screen.findByRole("dialog", { name: "Edit the finding H1" });
    await user.click(within(sheet).getByRole("button", { name: "Save the finding" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(message);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
