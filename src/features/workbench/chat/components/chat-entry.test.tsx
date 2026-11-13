import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatEntry } from "./chat-entry";

const AUTHORS = { ownerName: "Owner", agentName: "agent", agentDisplayName: "Agent" };

describe("ChatEntry", () => {
  it("shows the No Result badge and line for a call with no result", () => {
    render(
      <ChatEntry
        item={{
          kind: "tool-call",
          id: "e1:call_1",
          name: "mission.node.list",
          input: "{}",
          state: "no-result",
        }}
        authors={AUTHORS}
        runError={null}
        sessionId="workbench_session_1"
      />,
    );

    expect(screen.getByText("No Result")).toBeTruthy();
    expect(screen.getByText("No result. The run ended before this call finished.")).toBeTruthy();
  });
});
