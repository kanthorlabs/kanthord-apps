import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BoardGone } from "./board-gone";

function renderGone(subject: string | null, hasNext: boolean) {
  const onNext = vi.fn();
  render(
    <BoardGone
      subject={subject}
      hasNext={hasNext}
      onNext={onNext}
      titleId="gone-title"
      titleRef={() => undefined}
    />,
  );
  return onNext;
}

describe("BoardGone", () => {
  it("names the region by the title", () => {
    renderGone("Team", true);

    expect(screen.getByRole("region", { name: "This item no longer waits" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 3 })).toHaveAttribute("tabindex", "-1");
  });

  it("says that the item left the list", () => {
    renderGone("Team", true);

    expect(
      screen.getByText(
        "Team left the list at the last refresh. An act elsewhere or a change outside KanthorD resolved it.",
      ),
    ).toBeVisible();
  });

  it("says that the link points to an item that does not wait", () => {
    renderGone(null, false);

    expect(screen.getByText("This item no longer waits")).toBeVisible();
    expect(screen.getByText("The link points to an item that does not wait now.")).toBeVisible();
  });

  it("offers Next card when the tab holds a card", async () => {
    const onNext = renderGone("Team", true);

    await userEvent.setup().click(screen.getByRole("button", { name: "Next card" }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("offers no Next card when the tab holds none", () => {
    renderGone("Team", false);

    expect(screen.queryByRole("button", { name: "Next card" })).not.toBeInTheDocument();
  });
});
