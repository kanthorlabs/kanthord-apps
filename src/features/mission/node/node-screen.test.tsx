import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type {
  Attempt,
  Assessment,
  DependencyClosure,
  EligibilityReport,
  MissionNode,
  NodeRevision,
} from "@/api/types";

vi.mock("@/api/resources/mission", () => ({
  readNode: vi.fn(),
  listRevisions: vi.fn(),
  listAttempts: vi.fn(),
  readClosure: vi.fn(),
}));

vi.mock("@/api/resources/scheduler", () => ({
  readEligibility: vi.fn(),
}));

vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

import { readNode, listRevisions, listAttempts, readClosure } from "@/api/resources/mission";
import { readEligibility } from "@/api/resources/scheduler";
import { NodeScreen } from "./node-screen";

const baseNode: MissionNode = {
  id: "obj-1",
  kind: "objective",
  title: "Add password reset",
  state: "Blocked",
  parentId: "ini-1",
  dependsOn: [],
  goal: "A user resets a forgotten password.",
  steps: ["Issue token.", "Expire it."],
  validationCriteria: [{ id: "vc-1", text: "A reset link expires in one hour." }],
  verificationCommand: "pnpm test password-reset",
  repositoryBindingId: "bnd-repo",
  priority: 3,
  attemptCounter: 2,
  currentRevisionId: "rev-3",
};

const baseRevision: NodeRevision = {
  id: "rev-3",
  ordinal: 3,
  reason: "Narrow the expiry.",
  actor: "ulrich",
  time: new Date(Date.now() - 60_000).toISOString(),
  pinnedByAttempt: null,
};

const pinnedRevision: NodeRevision = {
  id: "rev-2",
  ordinal: 2,
  reason: "Add single-use criterion.",
  actor: "ulrich",
  time: new Date(Date.now() - 120_000).toISOString(),
  pinnedByAttempt: "att-1",
};

const currentAssessment: Assessment = {
  id: "as-current",
  attemptId: "att-1",
  nodeRevisionId: "rev-2",
  evidenceIds: [],
  childOutcomeIds: [],
  verdict: "does not meet",
  method: "model judgement",
  actor: { kind: "execution", executionId: "exec-current", clientId: null, name: "re@1" },
  time: new Date(Date.now() - 30_000).toISOString(),
  currency: { context: true, authority: true, order: true },
};

const nonCurrentAssessment: Assessment = {
  id: "as-stale",
  attemptId: "att-1",
  nodeRevisionId: "rev-1",
  evidenceIds: [],
  childOutcomeIds: [],
  verdict: "meets",
  method: "model judgement",
  actor: { kind: "execution", executionId: "exec-stale", clientId: null, name: "re@1" },
  time: new Date(Date.now() - 300_000).toISOString(),
  currency: { context: false, authority: true, order: false },
};

const passingAssessment: Assessment = {
  id: "as-passing",
  attemptId: "att-ef",
  nodeRevisionId: "rev-2",
  evidenceIds: [],
  childOutcomeIds: [],
  verdict: "meets",
  method: "model judgement",
  actor: { kind: "execution", executionId: "exec-passing", clientId: null, name: "re@1" },
  time: new Date(Date.now() - 60_000).toISOString(),
  currency: { context: true, authority: true, order: true },
};

const attemptWithBothAssessments: Attempt = {
  id: "att-1",
  nodeId: "obj-1",
  ordinal: 1,
  pinnedRevisionId: "rev-2",
  open: false,
  openedAt: new Date(Date.now() - 400_000).toISOString(),
  closedAt: new Date(Date.now() - 60_000).toISOString(),
  evidence: [],
  assessments: [currentAssessment, nonCurrentAssessment],
  outcome: null,
  externalObjects: [],
};

const externalFailedAttempt: Attempt = {
  id: "att-ef",
  nodeId: "obj-1",
  ordinal: 1,
  pinnedRevisionId: "rev-2",
  open: false,
  openedAt: new Date(Date.now() - 900_000).toISOString(),
  closedAt: new Date(Date.now() - 400_000).toISOString(),
  evidence: [],
  assessments: [passingAssessment],
  outcome: {
    id: "oc-ef",
    attemptId: "att-ef",
    assertedResult: "nothing established",
    closingEvent: "An External.Failed observation ended the attempt.",
    stoppingReason: "The pull request closed without a merge.",
    assessmentId: "as-passing",
    evidenceIds: [],
    previousOutcomeId: null,
    actor: "the observer",
    time: new Date(Date.now() - 400_000).toISOString(),
  },
  externalObjects: [],
};

const closure: DependencyClosure = {
  nodeId: "obj-1",
  members: [{ nodeId: "dep-1", title: "Prerequisite node", state: "Completed" }],
  holds: true,
};

const eligibility: EligibilityReport = {
  nodeId: "obj-1",
  checks: [
    { name: "A work-queue entry exists", holds: true, detail: "Entry wq-1 exists." },
    { name: "The entry is not held out", holds: false, detail: "Wait record present." },
  ],
};

function setupDefaultMocks(
  overrides: {
    attempts?: readonly Attempt[];
    revisions?: readonly NodeRevision[];
  } = {},
) {
  vi.mocked(readNode).mockResolvedValue(baseNode);
  vi.mocked(listRevisions).mockResolvedValue(overrides.revisions ?? [baseRevision, pinnedRevision]);
  vi.mocked(listAttempts).mockResolvedValue(overrides.attempts ?? []);
  vi.mocked(readClosure).mockResolvedValue(closure);
  vi.mocked(readEligibility).mockResolvedValue(eligibility);
}

function renderNodeScreen(nodeId = "obj-1") {
  render(
    <MemoryRouter initialEntries={[`/mission/${nodeId}`]}>
      <Routes>
        <Route path="/mission/:nodeId" element={<NodeScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NodeScreen header", () => {
  it("renders the node title and state", async () => {
    setupDefaultMocks();
    renderNodeScreen();

    await waitFor(() => {
      expect(screen.getByText("Add password reset")).toBeInTheDocument();
    });

    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });
});

describe("NodeScreen currency verdict rendering", () => {
  it("marks a fully current assessment as CURRENT", async () => {
    setupDefaultMocks({ attempts: [attemptWithBothAssessments] });
    renderNodeScreen();

    await waitFor(() => {
      expect(screen.getByText("Add password reset")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: "Attempts" }));

    expect(screen.getByText("CURRENT")).toBeInTheDocument();
  });

  it("marks a non-current assessment visibly with failing checks", async () => {
    setupDefaultMocks({ attempts: [attemptWithBothAssessments] });
    renderNodeScreen();

    await waitFor(() => {
      expect(screen.getByText("Add password reset")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: "Attempts" }));

    expect(screen.getByText(/NOT CURRENT — failing: context, order/)).toBeInTheDocument();
  });
});

describe("NodeScreen human assessment", () => {
  it("shows a human basis without a currency badge", async () => {
    const humanAssessment: Assessment = {
      ...currentAssessment,
      id: "as-human",
      attemptId: "att-ef",
      method: "human block",
      verdict: "neither established",
      actor: { kind: "human", account: "ulrich", name: "ulrich" },
      currency: null,
    };
    setupDefaultMocks({
      attempts: [
        {
          ...externalFailedAttempt,
          assessments: [humanAssessment],
          outcome: { ...externalFailedAttempt.outcome!, assessmentId: "as-human" },
        },
      ],
    });
    renderNodeScreen();

    await userEvent.click(await screen.findByRole("tab", { name: "Attempts" }));

    expect(screen.getByText("human assessment")).toBeInTheDocument();
    expect(screen.getByText("ulrich")).toBeInTheDocument();
    expect(screen.queryByText("CURRENT")).not.toBeInTheDocument();
  });
});

describe("NodeScreen External.Failed with passing assessment", () => {
  it("states the non-success outcome explicitly without implying the assessment failed", async () => {
    setupDefaultMocks({ attempts: [externalFailedAttempt] });
    renderNodeScreen();

    await waitFor(() => {
      expect(screen.getByText("Add password reset")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: "Attempts" }));

    expect(
      screen.getByText(/This outcome is non-success\. The basis assessment passes/),
    ).toBeInTheDocument();
    expect(screen.getByText("execution assessment")).toBeInTheDocument();
  });
});

describe("NodeScreen revisions tab", () => {
  it("shows revisions ordinal descending and marks unpinned ones", async () => {
    setupDefaultMocks();
    renderNodeScreen();

    await waitFor(() => {
      expect(screen.getByText("Add password reset")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: "Revisions" }));

    const rev3 = screen.getByText("Revision 3");
    const rev2 = screen.getByText("Revision 2");
    expect(rev3.compareDocumentPosition(rev2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByText("not pinned by any attempt")).toBeInTheDocument();
  });
});

describe("NodeScreen dependencies tab", () => {
  it("shows closure members and holds status", async () => {
    setupDefaultMocks();
    renderNodeScreen();

    await waitFor(() => {
      expect(screen.getByText("Add password reset")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: "Dependencies" }));

    expect(screen.getByText("Prerequisite node")).toBeInTheDocument();
    expect(screen.getByText("holds")).toBeInTheDocument();
  });
});

describe("NodeScreen why not running tab", () => {
  it("shows pass/fail checks with detail", async () => {
    setupDefaultMocks();
    renderNodeScreen();

    await waitFor(() => {
      expect(screen.getByText("Add password reset")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: "Why not running" }));

    expect(screen.getByText("A work-queue entry exists")).toBeInTheDocument();
    expect(screen.getByText("The entry is not held out")).toBeInTheDocument();
    expect(screen.getByText("Entry wq-1 exists.")).toBeInTheDocument();
    expect(screen.getByText("Wait record present.")).toBeInTheDocument();
  });

  it("says the daemon reports none when the checks array is empty", async () => {
    vi.mocked(readNode).mockResolvedValue(baseNode);
    vi.mocked(listRevisions).mockResolvedValue([]);
    vi.mocked(listAttempts).mockResolvedValue([]);
    vi.mocked(readClosure).mockResolvedValue(closure);
    vi.mocked(readEligibility).mockResolvedValue({ nodeId: "obj-1", checks: [] });

    renderNodeScreen();

    await waitFor(() => {
      expect(screen.getByText("Add password reset")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: "Why not running" }));

    expect(screen.getByText("The daemon reports no eligibility checks.")).toBeInTheDocument();
  });
});
