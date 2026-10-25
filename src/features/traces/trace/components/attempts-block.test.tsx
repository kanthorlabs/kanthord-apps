import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

import type { NodeExecution, NodeTraces } from "../use-node-traces";
import { AttemptsBlock } from "./attempts-block";

function execution(overrides: Partial<NodeExecution>): NodeExecution {
  return {
    traceId: "t1",
    kind: "steps",
    cause: null,
    kindLabel: "Steps",
    stateLabel: "Error",
    causeText: "Plan - decomposition",
    durationLabel: "2 s",
    isRepeat: false,
    advice: null,
    current: false,
    promptChanged: false,
    path: "/traces/t1?tab=summary",
    ...overrides,
  };
}

function node(overrides: Partial<NodeTraces> = {}): NodeTraces {
  return {
    items: [],
    groups: [],
    repeatedAttempts: 0,
    repeatedExecutions: 0,
    loading: false,
    error: null,
    retry: vi.fn(),
    ...overrides,
  };
}

function renderBlock(value: NodeTraces) {
  return render(
    <MemoryRouter>
      <AttemptsBlock node={value} />
    </MemoryRouter>,
  );
}

const TWO_ATTEMPTS = node({
  groups: [
    {
      attempt: 2,
      nodeRevision: 2,
      planChanged: true,
      executions: [
        execution({
          traceId: "t3",
          causeText: "Plan - oversized",
          current: true,
          promptChanged: true,
          path: "/traces/t3?tab=summary",
        }),
      ],
    },
    {
      attempt: 1,
      nodeRevision: 1,
      planChanged: false,
      executions: [
        execution({ traceId: "t1" }),
        execution({
          traceId: "t2",
          isRepeat: true,
          advice: "A retry does not fix this. Change the plan or the prompt.",
          path: "/traces/t2?tab=summary",
        }),
      ],
    },
  ],
  repeatedAttempts: 1,
  repeatedExecutions: 1,
});

describe("AttemptsBlock", () => {
  it("lists each attempt with its revision and the plan change", () => {
    renderBlock(TWO_ATTEMPTS);

    const block = screen.getByRole("region", { name: "Attempts of this node" });
    expect(within(block).getByRole("heading", { name: "Attempt 2 (v2)" })).toBeInTheDocument();
    expect(within(block).getByRole("heading", { name: "Attempt 1 (v1)" })).toBeInTheDocument();
    expect(within(block).getAllByText("Plan changed in (v2)")).toHaveLength(1);
  });

  it("shows kind, state, cause, duration and the marks of an execution", () => {
    renderBlock(TWO_ATTEMPTS);

    const [current] = within(screen.getByRole("region", { name: "Attempt 2 (v2)" })).getAllByRole(
      "listitem",
    );
    expect(current).toHaveTextContent("Steps Error");
    expect(current).toHaveTextContent("Plan - oversized");
    expect(current).toHaveTextContent("2 s");
    expect(within(current as HTMLElement).getByText("This trace")).toBeInTheDocument();
    expect(within(current as HTMLElement).getByText("Prompt changed")).toBeInTheDocument();
    expect(within(current as HTMLElement).queryByText("Repeat")).not.toBeInTheDocument();
  });

  it("marks a repeat and shows the advice", () => {
    renderBlock(TWO_ATTEMPTS);

    const rows = within(screen.getByRole("region", { name: "Attempt 1 (v1)" })).getAllByRole(
      "listitem",
    );
    expect(within(rows[0] as HTMLElement).queryByText("Repeat")).not.toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Repeat")).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByText(/A retry does not fix this/),
    ).toBeInTheDocument();
  });

  it("opens each trace on the Summary tab", () => {
    renderBlock(TWO_ATTEMPTS);

    expect(screen.getByRole("button", { name: "Open trace t2" })).toHaveAttribute(
      "href",
      "/traces/t2?tab=summary",
    );
  });

  it("keeps the block usable after a failed read", async () => {
    const retry = vi.fn();
    renderBlock(node({ error: new ApiError("unavailable", "The daemon is down.", 503), retry }));

    expect(screen.getByText("The daemon is down.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
