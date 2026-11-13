import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ChatItem } from "@/lib/workbench-chat";
import { ChatTranscript } from "./chat-transcript";
import { RunLine } from "./run-line";

const AUTHORS = { ownerName: "Ulrich", agentName: "swe@1", agentDisplayName: "SWE" };

const AT = Date.parse("2026-10-05T09:00:00.000Z");

const FIRST: ChatItem = { kind: "user", id: "u1", text: "First request", timestamp: AT };
const ANSWER: ChatItem = {
  kind: "assistant",
  id: "a1",
  text: "First answer",
  streaming: false,
  timestamp: AT,
};
const SECOND: ChatItem = { kind: "user", id: "u2", text: "Second request", timestamp: AT };
const CALL: ChatItem = {
  kind: "tool-call",
  id: "a2:call_1",
  name: "mission.node.list",
  input: "{}",
  state: "running",
};

function transcript(items: readonly ChatItem[], runActive: boolean) {
  return render(
    <ChatTranscript
      items={items}
      authors={AUTHORS}
      runError={null}
      runLine={(request) => (
        <RunLine
          runActive={runActive}
          busy={false}
          ownerName="Ulrich"
          request={request}
          onStop={vi.fn()}
        />
      )}
    />,
  );
}

function orderOf(): string[] {
  const log = screen.getByRole("log", { name: "Transcript" });
  return [...log.children].map((child) => child.textContent ?? "");
}

describe("RunLine", () => {
  it("shows Running and Stop while a run is active", async () => {
    const onStop = vi.fn();
    render(<RunLine runActive busy={false} ownerName="Ulrich" request={null} onStop={onStop} />);

    const line = screen.getByRole("group", { name: "Run line" });
    expect(within(line).getByText("Running")).toBeInTheDocument();
    await userEvent.click(within(line).getByRole("button", { name: "Stop" }));

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("shows nothing when no run is active", () => {
    render(
      <RunLine runActive={false} busy={false} ownerName="Ulrich" request={null} onStop={vi.fn()} />,
    );

    expect(screen.queryByRole("group", { name: "Run line" })).toBeNull();
  });

  it("shows the request of the run and who started it in the title", () => {
    render(
      <RunLine
        runActive
        busy={false}
        ownerName="Ulrich"
        request={{ text: "List   the open\nnodes", timestamp: AT }}
        onStop={vi.fn()}
      />,
    );

    const line = screen.getByRole("group", { name: "Run line" });
    expect(within(line).getByTitle(/^This run: started by Ulrich at /)).toHaveTextContent(
      "· List the open nodes",
    );
  });

  it("shows no request text before the request entry exists", () => {
    render(<RunLine runActive busy={false} ownerName="Ulrich" request={null} onStop={vi.fn()} />);

    expect(screen.getByRole("group", { name: "Run line" })).toHaveTextContent(/^RunningStop$/);
  });

  it("disables Stop while an action is in flight", () => {
    render(<RunLine runActive busy ownerName="Ulrich" request={null} onStop={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
  });
});

describe("ChatTranscript run line", () => {
  it("sits under the latest request and not under an earlier one", () => {
    transcript([FIRST, ANSWER, SECOND, CALL], true);

    const order = orderOf();
    const second = order.findIndex((text) => text.includes("Second request"));
    expect(order[second + 1]).toContain("Running");
    expect(order.filter((text) => text.includes("Stop"))).toHaveLength(1);
    expect(order.findIndex((text) => text.includes("First request"))).toBeLessThan(second);
  });

  it("sits at the end of the transcript before the request entry of the run exists", () => {
    transcript([FIRST, ANSWER], true);

    const order = orderOf();
    expect(order.at(-1)).toContain("Running");
    expect(order.at(-2)).toContain("First answer");
  });

  it("sits at the end of the transcript after a run that ended on a tool call", () => {
    const finished: ChatItem = { ...CALL, state: "no-result" };
    transcript([FIRST, ANSWER, SECOND, finished], true);

    const order = orderOf();
    expect(order.at(-1)).toContain("Running");
    expect(order.at(-2)).not.toContain("Running");
  });

  it("shows no run line for a finished run", () => {
    transcript([FIRST, ANSWER], false);

    expect(screen.queryByRole("group", { name: "Run line" })).toBeNull();
  });
});
