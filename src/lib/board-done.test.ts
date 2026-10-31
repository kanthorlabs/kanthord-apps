import { describe, expect, it } from "vitest";

import type { MissionNodeRecord, Project } from "@/api/types";

import type { AttentionItem } from "./attention";
import { type DoneAct, doneEntryOf, doneInView } from "./board-done";
import { BOARD_TAB, type BoardTabId } from "./board-tabs";

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const BETA: Project = { ...ATLAS, id: "prj-2", name: "beta" };

const AT = Date.UTC(2026, 9, 31, 9, 5, 59);

function itemOf(project: Project, subject: string): AttentionItem {
  return {
    id: `paused:${subject}`,
    kind: "paused",
    group: "decisions",
    project,
    subject,
    missionVersion: 1,
    node: {} as MissionNodeRecord,
    nodes: [],
    at: null,
    cause: "Cause",
    pause: null,
  } as AttentionItem;
}

function actOf(
  id: Exclude<DoneAct["id"], "remove_dependency">,
  tab: BoardTabId = BOARD_TAB.Resume,
): DoneAct {
  return { id, tab };
}

describe("doneEntryOf", () => {
  it.each([
    ["resume", "Resumed Print the slip."],
    ["unblock", "Unblocked Print the slip."],
    ["override", "Overrode Print the slip."],
    ["discard", "Discarded Print the slip."],
    ["decide", "Decided the proposals of Print the slip."],
    ["resume_project", "Resumed project Print the slip."],
  ] as const)("words the %s act", (id, text) => {
    expect(doneEntryOf(itemOf(ATLAS, "Print the slip"), actOf(id), AT).text).toBe(text);
  });

  it("words the removal of a dependency with its name", () => {
    const entry = doneEntryOf(
      itemOf(ATLAS, "Print the slip"),
      { id: "remove_dependency", tab: BOARD_TAB.Rule, dependency: "Label" },
      AT,
    );

    expect(entry.text).toBe("Removed the dependency of Print the slip on Label.");
  });

  it("answers the subject, the tab, the projects and the time in UTC", () => {
    const entry = doneEntryOf(itemOf(ATLAS, "Print the slip"), actOf("resume"), AT);

    expect(entry.itemId).toBe("paused:Print the slip");
    expect(entry.subject).toBe("Print the slip");
    expect(entry.tab).toBe(BOARD_TAB.Resume);
    expect(entry.projects).toEqual([ATLAS]);
    expect(entry.sentAt).toBe("Sent at 09:05 UTC");
  });
});

describe("doneInView", () => {
  const resumed = doneEntryOf(itemOf(ATLAS, "One"), actOf("resume"), AT);
  const other = doneEntryOf(itemOf(BETA, "Two"), actOf("resume"), AT);
  const rule = doneEntryOf(itemOf(ATLAS, "Three"), actOf("discard", BOARD_TAB.Rule), AT);
  const tool = doneEntryOf(itemOf(BETA, "Four"), actOf("resume", BOARD_TAB.Tool), AT);
  const entries = [resumed, other, rule, tool];

  it("keeps the entries of the tab, newest first", () => {
    expect(doneInView(entries, BOARD_TAB.Resume, null)).toEqual([other, resumed]);
  });

  it("scopes the entries to the filter project", () => {
    expect(doneInView(entries, BOARD_TAB.Resume, ATLAS.id)).toEqual([resumed]);
  });

  it("shows the entries of the tool tab under every filter", () => {
    expect(doneInView(entries, BOARD_TAB.Tool, ATLAS.id)).toEqual([tool]);
  });
});
