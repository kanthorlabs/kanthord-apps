import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BoardReadBlock } from "./board-read-block";

describe("BoardReadBlock", () => {
  it("shows a skeleton of two lines and a hidden reading note while the read runs", () => {
    const { container } = render(
      <BoardReadBlock name="the session" read={null} onRetry={vi.fn()}>
        {() => <p>Ready text</p>}
      </BoardReadBlock>,
    );

    expect(screen.getByText("Reading the session.")).toHaveClass("sr-only");
    expect(container.querySelectorAll("[data-slot='skeleton']")).toHaveLength(2);
    expect(screen.queryByText("Ready text")).not.toBeInTheDocument();
  });

  it("shows the failure and a Retry button that reads again", async () => {
    const onRetry = vi.fn();
    render(
      <BoardReadBlock
        name="the evidence"
        read={{ status: "failed", message: "Down." }}
        onRetry={onRetry}
      >
        {() => <p>Ready text</p>}
      </BoardReadBlock>,
    );

    expect(screen.getByText("Could not read the evidence.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Ready text")).not.toBeInTheDocument();
  });

  it("renders the children with the data of a ready read", () => {
    render(
      <BoardReadBlock
        name="the proposals"
        read={{ status: "ready", data: "alpha" }}
        onRetry={vi.fn()}
      >
        {(data) => <p>Data {data}</p>}
      </BoardReadBlock>,
    );

    expect(screen.getByText("Data alpha")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
