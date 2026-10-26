import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { MissionRevision, TraceSummary } from "@/api/types";

import type { TraceNode } from "../use-trace-node";
import { PlanBlock } from "./plan-block";

const SUMMARY = {
  trace_id: "trace-1",
  project_id: "project_1",
  node_id: "node_1",
  attempt: 1,
} as TraceSummary;

const REVISION = {
  node_id: "node_1",
  revision: 2,
  content: {
    name: "Ship it",
    requirement: "Build the thing",
    criterion: "The thing works",
    verifications: [],
  },
  tasks: [{ id: "task_a", filename: "a.md", content: { name: "Write code" } }],
} as unknown as MissionRevision;

const TRACE_NODE: TraceNode = {
  items: [],
  attempts: [],
  revision: REVISION,
  revisionError: null,
  taskNames: new Map(),
  loading: false,
  error: null,
  retry: () => undefined,
};

describe("PlanBlock", () => {
  it("shows the node at its revision with the task states and the node link", () => {
    render(
      <MemoryRouter>
        <PlanBlock summary={SUMMARY} spans={[]} traceNode={TRACE_NODE} />
      </MemoryRouter>,
    );
    expect(screen.getByText("The plan Ship it (v2)")).toBeInTheDocument();
    expect(screen.getByText("Write code open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open node" })).toHaveAttribute(
      "href",
      "/projects/project_1?node=node_1",
    );
  });

  it("reveals the whole requirement on More", async () => {
    render(
      <MemoryRouter>
        <PlanBlock summary={SUMMARY} spans={[]} traceNode={TRACE_NODE} />
      </MemoryRouter>,
    );
    const more = screen.getByRole("button", { name: "More requirement" });
    await userEvent.click(more);
    expect(screen.getByRole("button", { name: "Less requirement" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
