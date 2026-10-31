import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { Project } from "@/api/types";
import type { DoneEntry } from "@/lib/board-done";
import { BOARD_TAB } from "@/lib/board-tabs";

import { BoardDone } from "./board-done";

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const ENTRIES: readonly DoneEntry[] = [
  {
    itemId: "paused:a",
    subject: "Print the slip",
    tab: BOARD_TAB.Resume,
    projects: [ATLAS],
    text: "Resumed Print the slip.",
    sentAt: "Sent at 09:05 UTC",
  },
  {
    itemId: "paused:b",
    subject: "Pack the box",
    tab: BOARD_TAB.Resume,
    projects: [ATLAS],
    text: "Discarded Pack the box.",
    sentAt: "Sent at 09:07 UTC",
  },
];

describe("BoardDone", () => {
  it("shows nothing without an entry", () => {
    render(<BoardDone entries={[]} />);

    expect(screen.queryByText("Done this session")).toBeNull();
  });

  it("shows a closed heading button with the count", () => {
    render(<BoardDone entries={ENTRIES} />);

    const toggle = screen.getByRole("button", { name: "Done this session 2" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("heading", { level: 3 })).toContainElement(toggle);
    expect(screen.queryByText("Resumed Print the slip.")).toBeNull();
  });

  it("opens and closes the list of entries", async () => {
    const user = userEvent.setup();
    render(<BoardDone entries={ENTRIES} />);
    const toggle = screen.getByRole("button", { name: "Done this session 2" });

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("Resumed Print the slip.")).toBeVisible();
    expect(screen.getByText("Discarded Pack the box.")).toBeVisible();
    expect(screen.getByText("Sent at 09:05 UTC")).toBeVisible();
    expect(screen.getAllByText("atlas")).toHaveLength(2);

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
