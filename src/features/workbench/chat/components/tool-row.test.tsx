import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";
import { ToolRow } from "./tool-row";

const LONG_NAME = "project--agentConfiguration--list";

function renderNarrowRow() {
  return render(
    <div style={{ width: "390px" }}>
      <ToolRow
        label="Tool Call"
        name={LONG_NAME}
        detail='{"limit":5}'
        status={<Badge variant="secondary">Running</Badge>}
      />
    </div>,
  );
}

describe("ToolRow", () => {
  it("lets a long tool name shrink and truncate while the status badge renders", () => {
    renderNarrowRow();

    const row = screen.getByRole("button", { name: `Tool Call ${LONG_NAME}` });
    const name = within(row).getByText(LONG_NAME);

    expect(name).toHaveClass("min-w-0", "truncate");
    expect(name).not.toHaveClass("shrink-0");
    expect(row).toHaveClass("w-full", "min-w-0");
    expect(within(row).getByText("Running")).toBeTruthy();
  });

  it("lets the argument summary take only the space that the tool name leaves", () => {
    renderNarrowRow();

    const row = screen.getByRole("button", { name: `Tool Call ${LONG_NAME}` });
    const summary = within(row).getByText('{"limit":5}');

    expect(summary).toHaveClass("min-w-0", "grow", "basis-0", "truncate");
    expect(within(row).getByText(LONG_NAME)).not.toHaveClass("basis-0", "grow");
  });

  it("shows the full tool name in the opened row", async () => {
    renderNarrowRow();

    await userEvent.click(screen.getByRole("button", { name: `Tool Call ${LONG_NAME}` }));

    const names = screen.getAllByText(LONG_NAME);
    expect(names).toHaveLength(2);
    expect(names[1]).toHaveClass("break-all");
  });
});
