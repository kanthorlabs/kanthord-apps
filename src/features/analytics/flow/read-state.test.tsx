import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FlowRead } from "@/api/types";
import { ApiError } from "@/api/errors";

import flowRead from "../../../../test/flow-read.json";
import { ReadState } from "./read-state";

const FLOW_READ = flowRead as unknown as FlowRead;

function renderState(view: {
  read: FlowRead | null;
  error: ApiError | null;
  refresh?: () => void;
}) {
  return render(
    <ReadState view={{ refresh: vi.fn(), ...view }} skeleton={<p>Loading skeleton</p>}>
      <p>Loaded content</p>
    </ReadState>,
  );
}

describe("ReadState", () => {
  it("shows the skeleton while the first read runs", () => {
    renderState({ read: null, error: null });

    expect(screen.getByText("Loading skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Loaded content")).toBeNull();
  });

  it("shows the content for a read", () => {
    renderState({ read: FLOW_READ, error: null });

    expect(screen.getByText("Loaded content")).toBeInTheDocument();
    expect(screen.queryByText("Loading skeleton")).toBeNull();
  });

  it("keeps the content when a later read failed", () => {
    renderState({
      read: FLOW_READ,
      error: new ApiError("unavailable", "The daemon is down.", 503),
    });

    expect(screen.getByText("Loaded content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the error and Retry after a failed first read and reads again on Retry", async () => {
    const refresh = vi.fn();
    const user = userEvent.setup();
    renderState({
      read: null,
      error: new ApiError("unavailable", "The daemon is down.", 503),
      refresh,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("The daemon is down.");
    expect(screen.queryByText("Loading skeleton")).toBeNull();
    expect(screen.queryByText("Loaded content")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
