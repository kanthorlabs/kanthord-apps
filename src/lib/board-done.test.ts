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
  id: Exclude<DoneAct["id"], "remove_dependency" | "rotate" | "onboarding">,
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
    ["approve", "Approved Print the slip."],
    ["reject", "Rejected Print the slip."],
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

  it("words the start of an onboarding with the binding", () => {
    const entry = doneEntryOf(itemOf(ATLAS, "api"), { id: "onboarding", tab: BOARD_TAB.Setup }, AT);

    expect(entry.text).toBe("Onboarding of api started.");
  });

  it("words a rotate with the revision, the holders and the paused nodes", () => {
    const entry = doneEntryOf(
      itemOf(ATLAS, "openai-main"),
      { id: "rotate", tab: BOARD_TAB.Setup, revision: 4, holders: ["worker-1"], paused: 2 },
      AT,
    );

    expect(entry.text).toBe("Rotated openai-main to revision 4.");
    expect(entry.note).toBe("Also rotated on worker-1. 2 paused nodes in Resume can run again.");
    expect(entry.goTo).toEqual({ label: "Go to Resume", tab: BOARD_TAB.Resume });
  });

  it("lists each holder and says 1 paused node for one", () => {
    const entry = doneEntryOf(
      itemOf(ATLAS, "openai-main"),
      {
        id: "rotate",
        tab: BOARD_TAB.Setup,
        revision: 4,
        holders: ["worker-1", "worker-2"],
        paused: 1,
      },
      AT,
    );

    expect(entry.note).toBe(
      "Also rotated on worker-1, worker-2. 1 paused node in Resume can run again.",
    );
  });

  it("leaves out the holders of a server-only rotate and the nodes of none", () => {
    const only = doneEntryOf(
      itemOf(ATLAS, "openai-main"),
      { id: "rotate", tab: BOARD_TAB.Setup, revision: 4, holders: [], paused: 3 },
      AT,
    );
    const none = doneEntryOf(
      itemOf(ATLAS, "openai-main"),
      { id: "rotate", tab: BOARD_TAB.Setup, revision: 4, holders: [], paused: 0 },
      AT,
    );

    expect(only.note).toBe("3 paused nodes in Resume can run again.");
    expect(none.note).toBeUndefined();
    expect(none.goTo).toEqual({ label: "Go to Resume", tab: BOARD_TAB.Resume });
  });

  it("adds no note and no Go to to another act", () => {
    const entry = doneEntryOf(itemOf(ATLAS, "Print the slip"), actOf("approve"), AT);

    expect(entry.note).toBeUndefined();
    expect(entry.goTo).toBeUndefined();
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
