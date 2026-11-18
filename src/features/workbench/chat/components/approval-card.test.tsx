import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readMissionNode } from "@/api/resources/mission";
import { approveWorkbenchCall } from "@/api/resources/workbench";
import type { MissionNodeRecord, WorkbenchGuardCause, WorkbenchPendingApproval } from "@/api/types";
import { ApprovalCard } from "./approval-card";

vi.mock("@/api/resources/mission", () => ({ readMissionNode: vi.fn() }));
vi.mock("@/api/resources/workbench", () => ({ approveWorkbenchCall: vi.fn() }));

const readMock = vi.mocked(readMissionNode);
const approveMock = vi.mocked(approveWorkbenchCall);

function nodeNamed(name: string): MissionNodeRecord {
  return { id: "node_42", content: { name } } as unknown as MissionNodeRecord;
}

beforeEach(() => {
  readMock.mockReset();
  approveMock.mockReset();
});

const EVIDENCE: WorkbenchPendingApproval = {
  session_id: "session_1",
  requested_by: { kind: "owner", name: "Kanthor Labs" },
  tool_call_id: "call_1",
  operation_id: "mission.evidence.asset.content.download",
  guard: null,
  input: {
    node_id: "node_42",
    attempt: 3,
    evidence_id: "evidence_1",
    asset_id: "evidence_asset_9",
    kind: "object",
  },
};

const MUTATION: WorkbenchPendingApproval = {
  session_id: "session_1",
  requested_by: { kind: "owner", name: "Kanthor Labs" },
  tool_call_id: "call_2",
  operation_id: "project.create",
  guard: null,
  input: { name: "account-recovery" },
};

const IMPORT: WorkbenchPendingApproval = {
  session_id: "session_1",
  requested_by: { kind: "owner", name: "Kanthor Labs" },
  tool_call_id: "call_3",
  operation_id: "mission.import.apply",
  guard: null,
  input: {
    body: {
      format: "json",
      entries: [
        {
          id: "node_7",
          filename: "checkout.md",
          intent: "implement",
          name: "Checkout",
          requirement: "r",
          criterion: "c",
          verifications: [],
          bindings: [],
        },
        {
          filename: "checkout-task.md",
          node: "checkout.md",
          name: "Pay",
          requirement: "r",
          criterion: "c",
          verifications: [],
          bindings: [],
        },
      ],
    },
  },
};

const UNBLOCK: WorkbenchPendingApproval = {
  session_id: "session_1",
  requested_by: { kind: "owner", name: "Kanthor Labs" },
  tool_call_id: "call_4",
  operation_id: "mission.node.unblock",
  guard: null,
  input: { node_id: "node_7" },
};

const SHARED_EVIDENCE: WorkbenchPendingApproval = {
  ...EVIDENCE,
  input: { ...EVIDENCE.input, shared: true },
};

function mount(approval: WorkbenchPendingApproval, onDecide = vi.fn()) {
  render(
    <ApprovalCard
      approval={approval}
      agentDisplayName="RE"
      busy={false}
      failure={null}
      onDecide={onDecide}
    />,
  );
  return onDecide;
}

describe("ApprovalCard", () => {
  it("renders the evidence card with the agent, the facts and the grant sentence", () => {
    mount(EVIDENCE);

    const card = screen.getByRole("group", { name: "Evidence read" });
    expect(within(card).getByRole("heading", { name: "Evidence read" })).toBeTruthy();
    expect(within(card).getByText("agent: RE")).toBeTruthy();
    expect(within(card).getByText("node_id: node_42")).toBeTruthy();
    expect(within(card).getByText("attempt: 3")).toBeTruthy();
    expect(within(card).getByText("asset_id: evidence_asset_9")).toBeTruthy();
    expect(within(card).getByText("kind: object")).toBeTruthy();
    expect(card).toHaveTextContent(
      "Approve lets this conversation read every evidence asset of node node_42 until kanthord restarts or the conversation is shared.",
    );
    expect(within(card).queryByText("Operation ID")).toBeNull();
    expect(within(card).queryByText(/The agent asks to/)).toBeNull();
  });

  it("decides an evidence card with Approve and Reject", async () => {
    const onDecide = mount(EVIDENCE);

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(onDecide.mock.calls).toEqual([[true], [false]]);
  });

  it("keeps the render of another approval", () => {
    mount(MUTATION);

    const card = screen.getByRole("group", { name: "Approval Required" });
    expect(within(card).getByText("project.create")).toBeTruthy();
    expect(within(card).getByText(/"name": "account-recovery"/)).toBeTruthy();
    expect(within(card).queryByText(/Approve lets this conversation/)).toBeNull();
    expect(within(card).queryByText("RE")).toBeNull();
  });

  it("marks each import entry as update or create", () => {
    mount(IMPORT);

    const card = screen.getByRole("group", { name: "Approval Required" });
    const rows = within(card).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("update");
    expect(rows[0]).toHaveTextContent("implement");
    expect(rows[0]).toHaveTextContent("checkout.md");
    expect(rows[0]).toHaveTextContent("Checkout");
    expect(rows[0]).toHaveTextContent("node_7");
    expect(rows[1]).toHaveTextContent("create");
    expect(rows[1]).toHaveTextContent("task");
    expect(rows[1]).toHaveTextContent("Pay");
    expect(within(card).getByText("mission.import.apply")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Reject" })).toBeTruthy();
  });

  it.each([
    ["the import entries are not an array", { body: { format: "json" } }],
    ["the import input has no body", {}],
    ["an import entry is not an object", { body: { format: "json", entries: ["x"] } }],
    [
      "an import entry has no name",
      { body: { format: "json", entries: [{ filename: "a.md", node: "b.md" }] } },
    ],
    [
      "an import entry id is not a string",
      { body: { format: "json", entries: [{ id: 7, filename: "a.md", name: "A" }] } },
    ],
  ])("renders the plain card when %s", (_name, input) => {
    mount({ ...IMPORT, input });

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("mission.import.apply")).toBeTruthy();
    expect(document.querySelector("pre")?.textContent).toBe(JSON.stringify(input, null, 2));
  });

  it("renders another operation with the id, the input JSON and no entry row", () => {
    mount(UNBLOCK);

    const card = screen.getByRole("group", { name: "Approval Required" });
    expect(within(card).getByText("mission.node.unblock")).toBeTruthy();
    expect(within(card).getByText(/"node_id": "node_7"/)).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(within(card).queryAllByRole("listitem")).toHaveLength(0);
  });
  it.each([
    ["import", "Guard: import always needs your approval"],
    ["auto_mode_off", "Auto mode is off"],
    ["unavailable", "Guard: unavailable"],
    ["oversize", "Guard: the request is too large to judge"],
    ["no_verdict", "Guard: no verdict"],
  ] satisfies readonly (readonly [WorkbenchGuardCause, string])[])(
    "shows the fixed guard line of the %s cause below the facts",
    (cause, line) => {
      mount({ ...MUTATION, guard: { cause, reason: null, confidence: null } });

      const card = screen.getByRole("group", { name: "Approval Required" });
      const guard = within(card).getByText(line);
      const input = within(card).getByText(/"name": "account-recovery"/);
      expect(input.compareDocumentPosition(guard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    },
  );

  it("shows the guest request line and the exact input JSON for a guest-started run", () => {
    mount({
      ...MUTATION,
      requested_by: { kind: "guest", name: "Anna" },
      guard: { cause: "guest_run", reason: null, confidence: null },
    });

    const card = screen.getByRole("group", { name: "Approval Required" });
    expect(
      within(card).getByText("Requested in a run started by Anna (guest)"),
    ).toBeInTheDocument();
    expect(card).not.toHaveTextContent("Guard:");
    expect(card.querySelector("pre")?.textContent).toBe(
      JSON.stringify({ name: "account-recovery" }, null, 2),
    );
    expect(within(card).getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("shows no guest request line when the owner started the run", () => {
    mount(MUTATION);

    expect(screen.queryByText(/Requested in a run started by/)).not.toBeInTheDocument();
  });

  it("shows the classifier reason as model text with the confidence in two decimals", () => {
    mount({
      ...MUTATION,
      guard: { cause: "classifier", reason: "the owner directs this unblock", confidence: 0.9 },
    });

    expect(
      screen.getByText("Guard: Model: the owner directs this unblock (0.90)"),
    ).toBeInTheDocument();
  });

  it("renders a classifier reason as plain text, never as Markdown or HTML", () => {
    const reason = "**bold** <b>tag</b>";
    mount({ ...MUTATION, guard: { cause: "classifier", reason, confidence: 0.5 } });

    expect(screen.getByText(`Guard: Model: ${reason} (0.50)`)).toBeInTheDocument();
    expect(screen.queryByRole("strong")).toBeNull();
  });

  it("shows no guard line when the guard is null", () => {
    mount(EVIDENCE);

    expect(screen.queryByText(/Guard:/)).toBeNull();
    expect(screen.queryByText("Auto mode is off")).toBeNull();
  });

  it("shows the import guard line on an import card that keeps its entry rows", () => {
    mount({ ...IMPORT, guard: { cause: "import", reason: null, confidence: null } });

    const card = screen.getByRole("group", { name: "Approval Required" });
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    expect(within(card).getByText("Guard: import always needs your approval")).toBeTruthy();
  });

  describe("the evidence card of a shared conversation", () => {
    const TITLE = "Evidence read in a shared conversation";

    function mountShared(onAllowed = vi.fn(), onDecide = vi.fn()) {
      render(
        <ApprovalCard
          approval={SHARED_EVIDENCE}
          agentDisplayName="RE"
          busy={false}
          failure={null}
          onDecide={onDecide}
          onAllowed={onAllowed}
        />,
      );
      return { onAllowed, onDecide };
    }

    it("keeps the plain card with an unshared evidence call", () => {
      mount(EVIDENCE);

      expect(screen.queryByRole("group", { name: TITLE })).toBeNull();
      expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    });

    it("shows the title, the warning with the agent name, the facts and the grant line", async () => {
      readMock.mockResolvedValue(nodeNamed("Add password reset"));
      mountShared();

      const card = await screen.findByRole("group", { name: TITLE });
      expect(within(card).getByRole("heading", { name: TITLE })).toBeTruthy();
      expect(card).toHaveTextContent(
        "Guests see every answer in this conversation. RE can quote this evidence to them.",
      );
      expect(within(card).getByText("agent: RE")).toBeTruthy();
      expect(within(card).getByText("node: Add password reset (node_42) · attempt 3")).toBeTruthy();
      expect(within(card).getByText("asset_id: evidence_asset_9 · kind: object")).toBeTruthy();
      expect(card).toHaveTextContent(
        "Allow lets this conversation read every evidence asset of node node_42 until kanthord restarts or a new invite is created.",
      );
      expect(card.parentElement).toHaveClass("border-destructive");
    });

    it("shows an ellipsis in place of the node name while the name loads", async () => {
      readMock.mockReturnValue(new Promise(() => {}));
      mountShared();

      const card = await screen.findByRole("group", { name: TITLE });
      expect(within(card).getByText("node: … (node_42) · attempt 3")).toBeTruthy();
    });

    it("shows the node name in the destructive colour and as the placeholder", async () => {
      readMock.mockResolvedValue(nodeNamed("Add password reset"));
      mountShared();

      const name = await screen.findByText("Add password reset");
      expect(name).toHaveClass("text-destructive");
      expect(name.parentElement).toHaveTextContent("Type Add password reset to allow");
      expect(screen.getByPlaceholderText("Add password reset")).toHaveValue("");
    });

    it("keeps Allow disabled until the typed text equals the node name", async () => {
      readMock.mockResolvedValue(nodeNamed("Add password reset"));
      mountShared();
      const field = await screen.findByPlaceholderText("Add password reset");
      const allow = screen.getByRole("button", { name: "Allow" });
      expect(allow).toBeDisabled();

      await userEvent.type(field, "add password reset");
      expect(allow).toBeDisabled();

      await userEvent.clear(field);
      await userEvent.type(field, "Add password reset ");
      expect(allow).toBeDisabled();

      await userEvent.clear(field);
      await userEvent.type(field, "Add password reset");
      expect(allow).toBeEnabled();
    });

    it("sends the typed name as node_name and reports the allow", async () => {
      readMock.mockResolvedValue(nodeNamed("Add password reset"));
      approveMock.mockResolvedValue({
        session_id: "session_1",
        tool_call_id: "call_1",
        approved: true,
      });
      const { onAllowed } = mountShared();
      await userEvent.type(
        await screen.findByPlaceholderText("Add password reset"),
        "Add password reset",
      );

      await userEvent.click(screen.getByRole("button", { name: "Allow" }));

      await waitFor(() =>
        expect(approveMock).toHaveBeenCalledWith("session_1", "call_1", true, "Add password reset"),
      );
      await waitFor(() => expect(onAllowed).toHaveBeenCalledTimes(1));
    });

    it("shows the mismatch line and the fresh name after a 409", async () => {
      readMock
        .mockResolvedValueOnce(nodeNamed("Add password reset"))
        .mockResolvedValue(nodeNamed("Add password recovery"));
      approveMock.mockRejectedValue(
        new ApiError(
          "conflict",
          "The typed name does not match.",
          409,
          "workbench.evidence.name_mismatch",
        ),
      );
      mountShared();
      await userEvent.type(
        await screen.findByPlaceholderText("Add password reset"),
        "Add password reset",
      );

      await userEvent.click(screen.getByRole("button", { name: "Allow" }));

      const line = await screen.findByRole("alert");
      expect(line).toHaveTextContent(
        "workbench.evidence.name_mismatch The typed name does not match the node name. The card read the node again.",
      );
      expect(await screen.findByText("Add password recovery")).toHaveClass("text-destructive");
      expect(screen.getByPlaceholderText("Add password recovery")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Allow" })).toBeDisabled();
    });

    it("rejects through onDecide", async () => {
      readMock.mockResolvedValue(nodeNamed("Add password reset"));
      const { onDecide } = mountShared();
      await screen.findByPlaceholderText("Add password reset");

      await userEvent.click(screen.getByRole("button", { name: "Reject" }));

      expect(onDecide).toHaveBeenCalledWith(false);
    });
  });
});
