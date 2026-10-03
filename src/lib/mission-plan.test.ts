import { describe, expect, it } from "vitest";

import type { MissionPlanEntry } from "@/api/types";
import { importInputOf, importSnapshotOf, missionExportFilename, nodeNames } from "./mission-plan";

const ENTRY: MissionPlanEntry = {
  filename: "onboarding.md",
  id: "node_01J9ZQ4XKM3B6V8N2R5T7W0YA1",
  kind: "initiative",
  name: "Onboarding",
  requirement: "r",
  criterion: "c",
  verifications: ["v"],
  bindings: [],
};

describe("importInputOf", () => {
  it("reads the entries of one JSON export", () => {
    const result = importInputOf([
      { name: "kanthord-mission-v3.json", text: JSON.stringify({ entries: [ENTRY] }) },
    ]);
    expect(result).toEqual({ ok: true, input: { format: "json", entries: [ENTRY] } });
  });

  it("reads several Markdown plan files as files", () => {
    const result = importInputOf([
      { name: "a.md", text: "# A" },
      { name: "b.md", text: "# B" },
    ]);
    expect(result).toEqual({
      ok: true,
      input: {
        format: "markdown",
        files: [
          { filename: "a.md", content: "# A" },
          { filename: "b.md", content: "# B" },
        ],
      },
    });
  });

  it("refuses a JSON file without an entries array", () => {
    expect(importInputOf([{ name: "x.json", text: "{}" }])).toEqual({
      ok: false,
      error: 'x.json holds no "entries" array of a mission export.',
    });
  });

  it("refuses a JSON file that does not parse", () => {
    expect(importInputOf([{ name: "x.json", text: "{" }])).toEqual({
      ok: false,
      error: "x.json is not valid JSON.",
    });
  });

  it("refuses no file and a mix of formats", () => {
    expect(importInputOf([]).ok).toBe(false);
    expect(
      importInputOf([
        { name: "a.md", text: "" },
        { name: "b.json", text: "{}" },
      ]).ok,
    ).toBe(false);
  });
});

describe("importSnapshotOf", () => {
  it("carries the mission identity, the expected version and the reason", () => {
    expect(
      importSnapshotOf({ format: "json", entries: [ENTRY] }, "mission_1", 3, "Split onboarding"),
    ).toEqual({
      format: "json",
      missionId: "mission_1",
      missionVersion: 3,
      reason: "Split onboarding",
      entries: [ENTRY],
    });
  });
});

describe("nodeNames", () => {
  it("maps each known node identity to its name", () => {
    expect(nodeNames([ENTRY, { ...ENTRY, id: undefined, name: "New" }])).toEqual(
      new Map([[ENTRY.id, "Onboarding"]]),
    );
  });
});

describe("missionExportFilename", () => {
  it("names the project and the mission version", () => {
    expect(missionExportFilename("kanthord", 3)).toBe("kanthord-mission-v3.json");
  });
});
