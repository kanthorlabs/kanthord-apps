import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

import { BoardMoreSheet } from "./board-more-sheet";

function renderSheet(last = true) {
  render(
    <>
      <BoardMoreSheet
        subject="Print the slip"
        count={last ? 3 : 2}
        last={last ? <Button variant="destructive">Discard</Button> : null}
      >
        <Button variant="outline">Override</Button>
        <Button variant="outline">Last trace</Button>
      </BoardMoreSheet>
    </>,
  );
}

describe("BoardMoreSheet", () => {
  it("shows a More button with the count and no sheet", () => {
    renderSheet();

    expect(screen.getByRole("button", { name: "More (3)" })).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a bottom sheet titled by the subject with the acts and Discard last", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: "More (3)" }));

    const dialog = await screen.findByRole("dialog", { name: "More acts on Print the slip" });
    expect(dialog).toHaveAttribute("data-side", "bottom");
    const names = within(dialog)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(names).toEqual(["Override", "Last trace", "Discard", "Cancel"]);
    expect(within(dialog).getByRole("separator")).toBeInTheDocument();
  });

  it("shows no separator without a last act", async () => {
    const user = userEvent.setup();
    renderSheet(false);

    await user.click(screen.getByRole("button", { name: "More (2)" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("separator")).toBeNull();
  });

  it("closes on Esc and returns the focus to More", async () => {
    const user = userEvent.setup();
    renderSheet();
    const more = screen.getByRole("button", { name: "More (3)" });
    await user.click(more);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(more).toHaveFocus();
  });

  it("closes on Cancel and returns the focus to More", async () => {
    const user = userEvent.setup();
    renderSheet();
    const more = screen.getByRole("button", { name: "More (3)" });
    await user.click(more);
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(more).toHaveFocus();
  });
});
