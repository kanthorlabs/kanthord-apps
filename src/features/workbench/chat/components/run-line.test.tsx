import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { type ChatItem, runRequestOf } from "@/lib/workbench-chat";
import { ChatTranscript } from "./chat-transcript";
import { RunLine } from "./run-line";

const AUTHORS = { ownerName: "Ulrich", agentName: "swe@1", agentDisplayName: "SWE" };

const AT = Date.parse("2026-10-05T09:00:00.000Z");

const FIRST: ChatItem = { kind: "user", id: "u1", text: "First request", timestamp: AT };
const FIRST_REQUEST = FIRST as Extract<ChatItem, { kind: "user" }>;
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
      sessionId="workbench_session_1"
      runLine={
        <RunLine
          runActive={runActive}
          request={runRequestOf(items)}
          ownerName="Ulrich"
          busy={false}
          onStop={vi.fn()}
        />
      }
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
    render(
      <RunLine runActive request={FIRST_REQUEST} ownerName="Ulrich" busy={false} onStop={onStop} />,
    );

    const line = screen.getByRole("group", { name: "Run line" });
    expect(within(line).getByText("Running")).toBeInTheDocument();
    expect(within(line).getByText("· First request")).toHaveAttribute(
      "title",
      "This run: started by Ulrich at 2026-10-05 09:00 UTC",
    );
    await userEvent.click(within(line).getByRole("button", { name: "Stop" }));

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("shows Stop as a red text link without a background", () => {
    render(
      <RunLine
        runActive
        request={FIRST_REQUEST}
        ownerName="Ulrich"
        busy={false}
        onStop={vi.fn()}
      />,
    );

    const stop = within(screen.getByRole("group", { name: "Run line" })).getByRole("button", {
      name: "Stop",
    });
    expect(stop).toHaveClass("text-destructive");
    expect(stop.className).not.toMatch(/(^|\s)(dark:)?(hover:)?bg-(?!clip)/);
  });

  it("shows no request text before the request entry of the run exists", () => {
    render(<RunLine runActive request={null} ownerName="Ulrich" busy={false} onStop={vi.fn()} />);

    const line = screen.getByRole("group", { name: "Run line" });
    expect(line).toHaveTextContent(/^RunningStop$/);
  });

  it("shows nothing when no run is active", () => {
    render(
      <RunLine
        runActive={false}
        request={FIRST_REQUEST}
        ownerName="Ulrich"
        busy={false}
        onStop={vi.fn()}
      />,
    );

    expect(screen.queryByRole("group", { name: "Run line" })).toBeNull();
  });

  it("disables Stop while an action is in flight", () => {
    render(<RunLine runActive request={null} ownerName="Ulrich" busy onStop={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
  });
});

describe("ChatTranscript run line", () => {
  it("sits under the request before the run holds an agent item", () => {
    transcript([FIRST, ANSWER, SECOND], true);

    const order = orderOf();
    expect(order.at(-2)).toContain("Second request");
    expect(order.at(-1)).toContain("Running");
    expect(order.filter((text) => text.includes("Stop"))).toHaveLength(1);
  });

  it("sits after the latest agent item of the run", () => {
    transcript([FIRST, ANSWER, SECOND, CALL], true);

    const order = orderOf();
    expect(order.at(-2)).toContain("mission.node.list");
    expect(order.at(-1)).toContain("Running");
    expect(order.filter((text) => text.includes("Stop"))).toHaveLength(1);
  });

  it("sits at the end of the transcript before the request entry of the run exists", () => {
    transcript([FIRST, ANSWER], true);

    const order = orderOf();
    expect(order.at(-1)).toContain("Running");
    expect(order.at(-2)).toContain("First answer");
  });

  it("sits after a call that ended with no result", () => {
    const finished: ChatItem = { ...CALL, state: "no-result" };
    transcript([FIRST, ANSWER, SECOND, finished], true);

    const order = orderOf();
    expect(order.at(-1)).toContain("Running");
    expect(order.at(-2)).toContain("No Result");
  });

  it("shows no run line for a finished run", () => {
    transcript([FIRST, ANSWER], false);

    expect(screen.queryByRole("group", { name: "Run line" })).toBeNull();
  });
});
