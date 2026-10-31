import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import type { FlowRead } from "@/api/types";

import flowRead from "../../../../test/flow-read.json";
import { FlowTab } from "./flow-tab";

const FLOW_READ = flowRead as unknown as FlowRead;
const EMPTY_TEXT = "No executions claimed in this range.";

function renderTab(view: {
  read: FlowRead | null;
  error: ApiError | null;
  empty: boolean;
  refresh?: () => void;
}) {
  return render(
    <MemoryRouter>
      <FlowTab view={{ refresh: vi.fn(), ...view }} />
    </MemoryRouter>,
  );
}

describe("FlowTab", () => {
  it("shows the skeleton while the first read runs", () => {
    renderTab({ read: null, error: null, empty: false });

    expect(screen.getByRole("status", { name: "Loading the flow" })).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
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
