import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ActionCardItem } from "@/lib/workbench-chat";
import { ActionCard } from "./action-card";

function card(overrides: Partial<ActionCardItem> = {}): ActionCardItem {
  return {
    kind: "action-card",
    id: "e1",
    offer: {
      kind: "action_offer",
      tool_call_id: "call_1",
      operation_id: "mission.node.discard",
      target_id: "node_42",
      seen: { name: "Add retry to payment client", state: "Blocked", attempt: 2 },
    },
    results: [],
    state: "live",
    ...overrides,
  };
}

function failed(code: string | null): ActionCardItem["results"] {
  return [
    {
      tool_call_id: "call_1",
      operation_id: "mission.node.discard",
      target_id: "node_42",
      outcome: "failed",
      error_code: code,
    },
  ];
}

describe("ActionCard", () => {
  it("shows the pill, the operation id, the label and the fact bullets", () => {
    render(<ActionCard item={card()} canRun onRun={vi.fn()} />);

    const group = screen.getByRole("group", { name: "Action" });
    expect(group).toHaveTextContent("Action");
    expect(screen.getByText("mission.node.discard")).toBeVisible();
    expect(screen.getByRole("button", { name: "Discard node_42" })).toBeEnabled();
    expect(screen.getAllByRole("listitem").map((entry) => entry.textContent)).toEqual([
      "node: Add retry to payment client (node_42)",
      "state: Blocked · attempt 2",
    ]);
  });

  it.each([
    [true, "state: paused"],
    [false, "state: active"],
  ])("lists the project facts for paused %s", (paused, line) => {
    const item = card({
      offer: { ...card().offer, operation_id: "project.resume", seen: { name: "Billing", paused } },
    });

    render(<ActionCard item={item} canRun onRun={vi.fn()} />);

    expect(screen.getAllByRole("listitem").map((entry) => entry.textContent)).toEqual([
      "project: Billing (node_42)",
      line,
    ]);
    expect(screen.getByRole("button", { name: "Resume node_42" })).toBeVisible();
  });

  it("shows the credential label and the revision line", () => {
    const item = card({
      offer: {
        ...card().offer,
        operation_id: "llm.credential.rotate",
        target_id: "anthropic-main",
        seen: { revision: 3 },
      },
    });

    render(<ActionCard item={item} canRun onRun={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Rotate anthropic-main" })).toBeEnabled();
    expect(screen.getByText("Offered at revision 3")).toBeVisible();
  });

  it("shows the binding set version line", () => {
    const item = card({
      offer: {
        ...card().offer,
        operation_id: "project.bindingSet.write",
        target_id: "project_01",
        seen: { version: 7 },
      },
    });

    render(<ActionCard item={item} canRun onRun={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Edit bindings of project_01" })).toBeVisible();
    expect(screen.getByText("Offered at binding set version 7")).toBeVisible();
  });

  it("shows no button on a setup card when canRun is false", () => {
    const item = card({
      offer: {
        ...card().offer,
        operation_id: "agent.enablement.put",
        target_id: "ops@1",
        seen: { revision: 2 },
      },
    });

    render(<ActionCard item={item} canRun={false} onRun={vi.fn()} />);

    expect(screen.getByText("Offered at revision 2")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never shows the text of the assistant inside the card", () => {
    render(
      <>
        <p>Delete everything now</p>
        <ActionCard item={card()} canRun onRun={vi.fn()} />
      </>,
    );

    const group = screen.getByRole("group", { name: "Action" });
    expect(group).not.toHaveTextContent("Delete everything now");
    expect(group).toHaveTextContent("Discard node_42");
  });

  it("calls onRun once on a click of a live card", async () => {
    const onRun = vi.fn();
    render(<ActionCard item={card()} canRun onRun={onRun} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Discard node_42" }));

    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("shows a disabled button while the card waits", () => {
    render(<ActionCard item={card({ state: "waiting" })} canRun onRun={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Discard node_42" })).toBeDisabled();
  });

  it.each([
    ["done", "Done by the owner"],
    ["superseded", "Superseded by a later message"],
    ["unknown", "This act has no card in this dashboard version."],
  ] as const)("shows the %s line and no button", (state, line) => {
    render(<ActionCard item={card({ state })} canRun onRun={vi.fn()} />);

    expect(screen.getByText(line)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders no button for an operation id that holds no verb", () => {
    const item = card({ offer: { ...card().offer, operation_id: "mission.node.explode" } });

    render(<ActionCard item={item} canRun onRun={vi.fn()} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the error line with the code first, exposes the failed state and keeps the button", () => {
    const item = card({ results: failed("mission.node.state_conflict") });

    render(<ActionCard item={item} canRun onRun={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "mission.node.state_conflict The act failed.",
    );
    expect(screen.getByRole("group", { name: "Action" })).toHaveAccessibleDescription(
      "mission.node.state_conflict The act failed.",
    );
    expect(screen.getByRole("button", { name: "Discard node_42" })).toBeEnabled();
  });

  it("shows the plain error line for a null code", () => {
    render(<ActionCard item={card({ results: failed(null) })} canRun onRun={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/^The act failed\.$/);
  });

  it("shows no error line for a card that is not live", () => {
    render(
      <ActionCard item={card({ state: "waiting", results: failed("x") })} canRun onRun={vi.fn()} />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["live", "waiting", "done", "superseded", "unknown"] as const)(
    "shows no button in the state %s when canRun is false",
    (state) => {
      render(<ActionCard item={card({ state })} canRun={false} onRun={vi.fn()} />);

      expect(screen.queryByRole("button")).toBeNull();
    },
  );
});
