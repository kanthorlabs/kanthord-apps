import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WorkbenchPendingApproval } from "@/api/types";
import { ApprovalCard } from "./approval-card";

const EVIDENCE: WorkbenchPendingApproval = {
  tool_call_id: "call_1",
  operation_id: "mission.evidence.asset.content.download",
  input: {
    node_id: "node_42",
    attempt: 3,
    evidence_id: "evidence_1",
    asset_id: "evidence_asset_9",
    kind: "object",
  },
};

const MUTATION: WorkbenchPendingApproval = {
  tool_call_id: "call_2",
  operation_id: "project.create",
  input: { name: "account-recovery" },
};

const IMPORT: WorkbenchPendingApproval = {
  tool_call_id: "call_3",
  operation_id: "mission.import.apply",
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
  tool_call_id: "call_4",
  operation_id: "mission.node.unblock",
  input: { node_id: "node_7" },
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
      "Approve lets this conversation read every evidence asset of node node_42 until kanthord restarts.",
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
});
