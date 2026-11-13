import { describe, expect, it } from "vitest";

import type { Project } from "@/api/types";

import type { FixAttentionItem } from "./fix-attention";
import { deckCardTextOf, deckRowTextOf } from "./deck-card";

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const NOW = Date.UTC(2026, 4, 12, 11, 0, 0);

const ITEM: FixAttentionItem = {
  id: "project_paused:prj-1",
  kind: "project_paused",
  group: "fixes",
  project: PROJECT,
  projects: [PROJECT],
  at: NOW - 3_600_000,
  subject: "atlas",
  cause: "Project paused",
  nodeIds: [],
};

describe("deckCardTextOf", () => {
  it("names the tab, the projects, the age, the held nodes, the title and the cause", () => {
    expect(deckCardTextOf(ITEM, new Map(), NOW, 2)).toEqual({
      tab: "Fix setup",
      projects: [PROJECT],
      waiting: "Waiting 1 h · since 10:00",
      heldOn: "2 nodes wait on this",
      label: null,
      title: "atlas: project paused",
      cause: "Project paused",
    });
  });

  it("answers no held text for 0 held nodes", () => {
    expect(deckCardTextOf(ITEM, new Map(), NOW, 0).heldOn).toBeNull();
  });
});

describe("deckRowTextOf", () => {
  it("names the short tab, the age and the cause", () => {
    expect(deckRowTextOf(ITEM, new Map(), NOW)).toEqual({
      tab: "Setup",
      waiting: "Waiting 1 h · since 10:00",
      cause: "Project paused",
    });
  });
});
