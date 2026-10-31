import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RefreshStatus } from "./refresh-status";

const NOW = 1_760_000_000_000;

describe("RefreshStatus", () => {
  it("names the age of the data without a stale mark", () => {
    render(<RefreshStatus updatedAt={NOW - 30_000} now={NOW} onRefresh={vi.fn()} />);

    expect(screen.getByText("Updated just now")).toBeInTheDocument();
    expect(screen.queryByText("Stale")).toBeNull();
  });

  it("marks data older than one minute as stale", () => {
    render(<RefreshStatus updatedAt={NOW - 120_000} now={NOW} onRefresh={vi.fn()} />);

    expect(screen.getByText("Updated 2 minutes ago")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });

  it("names no age before the first read", () => {
    render(<RefreshStatus updatedAt={null} now={0} onRefresh={vi.fn()} />);

    expect(screen.queryByText(/Updated/)).toBeNull();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("refreshes on click", async () => {
    const onRefresh = vi.fn();
    render(<RefreshStatus updatedAt={NOW} now={NOW} onRefresh={onRefresh} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the stock button height without the touch prop", () => {
    render(<RefreshStatus updatedAt={NOW} now={NOW} onRefresh={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Refresh" })).not.toHaveClass("min-h-11");
  });

  it("sets a 44 px minimum height below 1024 px with the touch prop", () => {
    render(<RefreshStatus touch updatedAt={NOW} now={NOW} onRefresh={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Refresh" })).toHaveClass("min-h-11", "lg:min-h-0");
  });
});
