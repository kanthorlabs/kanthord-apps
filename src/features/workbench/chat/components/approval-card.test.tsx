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
    expect(within(card).getByText("RE")).toBeTruthy();
    expect(within(card).getByText("node_42")).toBeTruthy();
    expect(within(card).getByText("3")).toBeTruthy();
    expect(within(card).getByText("evidence_asset_9")).toBeTruthy();
    expect(within(card).getByText("object")).toBeTruthy();
    expect(card).toHaveTextContent(
      "Approve lets this conversation read every evidence asset of node node_42 until kanthord restarts.",
    );
    expect(within(card).queryByText("Operation ID")).toBeNull();
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
});
