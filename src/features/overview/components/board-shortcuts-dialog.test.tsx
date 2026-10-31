import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { BOARD_KEYS } from "@/lib/board-keys";

import { BoardShortcutsDialog } from "./board-shortcuts-dialog";

function Harness({ initiallyOpen = false }: { readonly initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <BoardShortcutsDialog open={open} onOpenChange={setOpen} />;
}

describe("BoardShortcutsDialog", () => {
  it("shows a button named Keyboard shortcuts that opens the dialog", async () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));

    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  });

  it("lists every key with its meaning", () => {
    render(<Harness initiallyOpen />);

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });

    expect(within(dialog).getByText("Show a tab")).toBeVisible();
    expect(within(dialog).getByText("1 to 6")).toBeVisible();
    expect(within(dialog).getByText("Select the next card")).toBeVisible();
    expect(within(dialog).getByText("Cycle the project filter")).toBeVisible();
    expect(within(dialog).getByText("Resume the node")).toBeVisible();
    for (const letter of new Set(Object.values(BOARD_KEYS))) {
      expect(within(dialog).getAllByText(letter).length).toBeGreaterThan(0);
    }
  });

  it("holds a switch for the single-key shortcuts that is on by default", () => {
    render(<Harness initiallyOpen />);

    expect(screen.getByRole("switch", { name: "Single-key shortcuts" })).toBeChecked();
  });

  it("stores the switch off and on", async () => {
    const user = userEvent.setup();
    render(<Harness initiallyOpen />);

    await user.click(screen.getByRole("switch", { name: "Single-key shortcuts" }));

    expect(screen.getByRole("switch", { name: "Single-key shortcuts" })).not.toBeChecked();
    expect(window.localStorage.getItem("kd-board-shortcuts")).toBe("off");

    await user.click(screen.getByRole("switch", { name: "Single-key shortcuts" }));

    expect(window.localStorage.getItem("kd-board-shortcuts")).toBe("on");
  });

  it("keeps the button when the shortcuts are off", () => {
    window.localStorage.setItem("kd-board-shortcuts", "off");
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Keyboard shortcuts" })).toBeVisible();
  });

  it("hides the button on a device without hover", () => {
    render(<Harness />);

    const wrapper = screen.getByRole("button", { name: "Keyboard shortcuts" }).parentElement
      ?.parentElement;

    expect(wrapper).toHaveClass("[@media(hover:none)]:hidden");
  });
});
