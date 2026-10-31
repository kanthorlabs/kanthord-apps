import { describe, expect, it } from "vitest";

import { BOARD_TAB, BOARD_TABS } from "./board-tabs";
import { BOARD_WIDTH } from "./board-width";
import {
  ageTextOf,
  dependencySeparatorOf,
  discardedVerbOf,
  emptyLineOf,
  goneTextOf,
  healthMessageOf,
  noticeTextOf,
  tabVerbOf,
} from "./board-pane-text";

const TOOL = BOARD_TABS.find((tab) => tab.id === BOARD_TAB.Tool)!;
const RULE = BOARD_TABS.find((tab) => tab.id === BOARD_TAB.Rule)!;

describe("ageTextOf", () => {
  it("says the age is unknown without a time", () => {
    expect(ageTextOf(null, 1_000)).toBe("age unknown");
  });

  it("reads the relative age of a time", () => {
    expect(ageTextOf(1_000, 1_000)).not.toBe("age unknown");
  });
});

describe("emptyLineOf", () => {
  it("names the tab", () => {
    expect(emptyLineOf(RULE, null)).toBe(`Nothing waits in ${RULE.name}.`);
  });

  it("names the project of a filter", () => {
    expect(emptyLineOf(RULE, "atlas")).toBe(`Nothing waits in ${RULE.name} in atlas.`);
  });
});

describe("tabVerbOf", () => {
  it("gives the verb alone on the expanded width", () => {
    expect(tabVerbOf(RULE, BOARD_WIDTH.Expanded, false)).toBe(RULE.verb);
  });

  it("adds what the tab holds on the medium width", () => {
    expect(tabVerbOf(RULE, BOARD_WIDTH.Medium, false)).toBe(`${RULE.verb} ${RULE.what}`);
  });

  it("adds the all-projects note to the tool tab under a filter", () => {
    expect(tabVerbOf(TOOL, BOARD_WIDTH.Compact, true)).toBe(`${TOOL.verb} Counts all projects.`);
  });

  it("adds no note to another tab under a filter", () => {
    expect(tabVerbOf(RULE, BOARD_WIDTH.Compact, true)).toBe(RULE.verb);
  });
});

describe("goneTextOf", () => {
  it("explains a link to an item that does not wait", () => {
    expect(goneTextOf(null)).toBe("The link points to an item that does not wait now.");
  });

  it("names the subject that left the list", () => {
    expect(goneTextOf("Node A")).toBe(
      "Node A left the list at the last refresh. An act elsewhere or a change outside KanthorD resolved it.",
    );
  });
});

describe("healthMessageOf", () => {
  it("lists the failed components", () => {
    expect(healthMessageOf(["db", "queue"], null)).toBe("db, queue. Operate the host.");
  });

  it("reports a liveness failure before the components", () => {
    expect(healthMessageOf(["db"], "timeout")).toBe(
      "The liveness of the daemon could not be read: timeout",
    );
  });
});

describe("noticeTextOf", () => {
  it("returns the text of a notice for the selected item", () => {
    expect(noticeTextOf({ text: "Done", itemId: "a" }, "a")).toBe("Done");
  });

  it("returns null for the notice of another item", () => {
    expect(noticeTextOf({ text: "Done", itemId: "a" }, "b")).toBeNull();
  });

  it("returns null without a notice", () => {
    expect(noticeTextOf(null, "a")).toBeNull();
  });
});

describe("dependencySeparatorOf", () => {
  it("puts no separator before the first name", () => {
    expect(dependencySeparatorOf(0, 3)).toBe("");
  });

  it("separates the middle names with a comma", () => {
    expect(dependencySeparatorOf(1, 3)).toBe(", ");
  });

  it("joins the last name with and", () => {
    expect(dependencySeparatorOf(2, 3)).toBe(" and ");
    expect(dependencySeparatorOf(1, 2)).toBe(" and ");
  });
});

describe("discardedVerbOf", () => {
  it("agrees with the count", () => {
    expect(discardedVerbOf(1)).toBe("is");
    expect(discardedVerbOf(2)).toBe("are");
  });
});
