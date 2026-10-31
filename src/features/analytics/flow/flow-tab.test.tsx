import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import type { FlowRead } from "@/api/types";

import flowRead from "../../../../test/flow-read.json";
import { flowFiltersOf } from "@/lib/flow-query";

import { FlowTab } from "./flow-tab";

const FLOW_READ = flowRead as unknown as FlowRead;
const FILTERS = flowFiltersOf(new URLSearchParams());
const EMPTY_TEXT = "No executions claimed in this range.";

function renderTab(
  view: {
    read: FlowRead | null;
    error: ApiError | null;
    empty: boolean;
    refresh?: () => void;
  },
  entry = "/analytics",
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <FlowTab view={{ refresh: vi.fn(), filters: FILTERS, ...view }} />
    </MemoryRouter>,
  );
}

describe("FlowTab", () => {
  it("shows the skeleton with six columns while the first read runs", () => {
    renderTab({ read: null, error: null, empty: false });

    const status = screen.getByRole("status", { name: "Loading the flow" });
    expect(within(status).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Flow" })).toBeNull();
  });

  it("shows the skeleton of each section and no Out of bounds while the first read runs", () => {
    renderTab({ read: null, error: null, empty: false });

    expect(screen.getByRole("status", { name: "Loading the causes" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading the stop reasons" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Out of bounds/ })).toBeNull();
  });

  it("shows the five sections in order after the read", () => {
    renderTab({ read: FLOW_READ, error: null, empty: false });

    const names = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent?.split(" ")[0]);
    expect(names).toEqual(["Out", "Flow", "Why", "Stop"]);
    const lastHeading = screen.getByRole("heading", { name: "Stop reasons" });
    expect(
      lastHeading.compareDocumentPosition(screen.getByText("Completeness")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows no cost or token scorecard", () => {
    renderTab({ read: FLOW_READ, error: null, empty: false });

    expect(screen.queryByRole("heading", { name: "Cost and tokens" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Cost tiles" })).toBeNull();
  });

  it("shows the flow section after the read", () => {
    renderTab({ read: FLOW_READ, error: null, empty: false });

    expect(screen.getByRole("heading", { name: "Flow" })).toBeInTheDocument();
    expect(screen.getByText("leak rate 16.7 % 7d")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading the flow" })).toBeNull();
  });

  it("shows no flow section for a read with no execution", () => {
    renderTab({ read: FLOW_READ, error: null, empty: true });

    expect(screen.queryByRole("heading", { name: "Flow" })).toBeNull();
  });

  it("keeps the Why, stop-reason and data sections for a read with no execution", () => {
    renderTab({ read: FLOW_READ, error: null, empty: true });

    expect(screen.getByRole("heading", { name: /^Why/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stop reasons" })).toBeInTheDocument();
    expect(screen.getByText("Completeness")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Out of bounds/ })).toBeNull();
  });

  it("shows the empty text with links to Scheduler and Workers for a read with no execution", () => {
    renderTab({
      read: {
        ...FLOW_READ,
        completeness: { ...FLOW_READ.completeness, executions: 0 },
      },
      error: null,
      empty: true,
    });

    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scheduler" })).toHaveAttribute("href", "/scheduler");
    expect(screen.getByRole("button", { name: "Workers" })).toHaveAttribute("href", "/workers");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows no empty text for a read with executions", () => {
    renderTab({ read: FLOW_READ, error: null, empty: false });

    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("moves the focus to the data footer for the hash flow-data", () => {
    renderTab({ read: FLOW_READ, error: null, empty: false }, "/analytics?tab=flow#flow-data");

    expect(screen.getByText("Completeness").closest("dl")).toHaveFocus();
  });

  it("keeps the focus where it is without the hash flow-data", () => {
    renderTab({ read: FLOW_READ, error: null, empty: false });

    expect(screen.getByText("Completeness").closest("dl")).not.toHaveFocus();
  });

  it("moves no focus while the first read runs", () => {
    renderTab({ read: null, error: null, empty: false }, "/analytics#flow-data");

    expect(document.body).toHaveFocus();
  });

  it("shows the error and Retry after a failed first read", async () => {
    const refresh = vi.fn();
    const user = userEvent.setup();
    renderTab({
      read: null,
      error: new ApiError("unavailable", "The daemon is down.", 503),
      empty: false,
      refresh,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("The daemon is down.");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
