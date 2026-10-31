import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import type { FlowRead } from "@/api/types";
import { flowFiltersOf } from "@/lib/flow-query";

import flowRead from "../../../../test/flow-read.json";
import { CostTab } from "./cost-tab";

const FLOW_READ = flowRead as unknown as FlowRead;
const FILTERS = flowFiltersOf(new URLSearchParams("tab=cost"));

function renderTab(view: { read: FlowRead | null; error: ApiError | null; refresh?: () => void }) {
  return render(
    <MemoryRouter>
      <CostTab view={{ refresh: vi.fn(), filters: FILTERS, empty: false, ...view }} />
    </MemoryRouter>,
  );
}

describe("CostTab", () => {
  it("shows the skeleton with eight tiles while the first read runs", () => {
    renderTab({ read: null, error: null });

    const status = screen.getByRole("status", { name: "Loading the cost" });
    expect(within(status).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryByRole("heading", { name: "Cost and tokens" })).toBeNull();
  });

  it("shows the error and Retry after a failed first read", async () => {
    const refresh = vi.fn();
    const user = userEvent.setup();
    renderTab({
      read: null,
      error: new ApiError("unavailable", "The flow is down.", 503),
      refresh,
    });

    expect(screen.getByText("The flow is down.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "Cost and tokens" })).toBeNull();
  });

  it("shows the scorecard after the read", () => {
    renderTab({ read: FLOW_READ, error: null });

    expect(screen.getByRole("heading", { name: "Cost and tokens" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Cost by model" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading the cost" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
