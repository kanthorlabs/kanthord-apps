import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { WorkbenchGuardRecord, WorkbenchRunSnapshot } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { chatItemsOf } from "@/lib/workbench-chat";
import { ChatEntry } from "./chat-entry";
import { ToolRow } from "./tool-row";

const IDLE: WorkbenchRunSnapshot = {
  streaming_message: null,
  pending_tool_calls: [],
  pending_approval: null,
  queue: [],
  run_active: false,
  error_message: null,
  auto_mode: true,
};

const AUTHORS = { ownerName: "Owner", agentName: "agent", agentDisplayName: "Agent" };

function recordEntry(id: string, data: Record<string, unknown>) {
  return {
    type: "custom",
    id,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    customType: "kanthord.workbench.record",
    data,
  };
}

function renderTranscript(extra: ReturnType<typeof recordEntry>) {
  const call = {
    type: "message",
    id: "e1",
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    message: {
      role: "assistant",
      content: [{ type: "toolCall", id: "call_1", name: "mission.node.list", arguments: {} }],
    },
  };
  for (const item of chatItemsOf([call, extra], IDLE)) {
    render(<ChatEntry item={item} authors={AUTHORS} runError={null} sessionId="session_1" />);
  }
}

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

  describe("guard records of the transcript", () => {
    it("shows the auto line of a call with a guard record", () => {
      renderTranscript(
        recordEntry("e2", {
          kind: "guard",
          tool_call_id: "call_1",
          operation_id: "mission.node.list",
          reason: "reversible",
        }),
      );

      expect(screen.getByText("Ran without approval: reversible")).toBeInTheDocument();
    });

    it("renders no line for an auto_mode record", () => {
      renderTranscript(recordEntry("e2", { kind: "auto_mode", enabled: true }));

      expect(screen.getByRole("button", { name: "Tool Call mission.node.list" })).toBeTruthy();
      expect(screen.queryByText(/Ran without approval/)).toBeNull();
      expect(screen.queryByText(/Auto mode/)).toBeNull();
    });
  });

  describe("guard record", () => {
    function renderGuarded(guard: WorkbenchGuardRecord | null) {
      render(
        <ToolRow
          label="Tool Call"
          name="mission.node.list"
          detail="{}"
          status={null}
          guard={guard}
        />,
      );
    }

    function guardOf(reason: string): WorkbenchGuardRecord {
      return {
        kind: "guard",
        tool_call_id: "call_1",
        operation_id: "mission.node.list",
        reason,
      };
    }

    it("shows the reversible reason as plain server text with no label", () => {
      renderGuarded(guardOf("reversible"));

      expect(screen.getByText("Ran without approval: reversible")).toBeInTheDocument();
      expect(screen.queryByText(/Model:/)).toBeNull();
    });

    it("marks a classifier reason as model text and renders it as plain text", () => {
      renderGuarded(guardOf("**it** <i>only</i> reads"));

      expect(
        screen.getByText("Ran without approval: Model: **it** <i>only</i> reads"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("strong")).toBeNull();
    });

    it("shows no line for a call with no guard record", () => {
      renderGuarded(null);

      expect(screen.queryByText(/Ran without approval/)).toBeNull();
    });
  });
});
