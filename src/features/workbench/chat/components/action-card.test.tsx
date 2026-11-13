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
      seen: { state: "Blocked", attempt: 2 },
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
      "node: node_42",
      "state: Blocked · attempt 2",
    ]);
  });

  it.each([
    [true, "state: paused"],
    [false, "state: active"],
  ])("lists the project facts for paused %s", (paused, line) => {
    const item = card({
      offer: { ...card().offer, operation_id: "project.resume", seen: { paused } },
    });

    render(<ActionCard item={item} canRun onRun={vi.fn()} />);

    expect(screen.getAllByRole("listitem").map((entry) => entry.textContent)).toEqual([
      "project: node_42",
      line,
    ]);
    expect(screen.getByRole("button", { name: "Resume node_42" })).toBeVisible();
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
