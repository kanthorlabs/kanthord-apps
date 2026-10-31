import { describe, expect, it } from "vitest";

import type { NoTakerItem } from "./fix-attention";
import {
  exampleOf,
  issuesTextOf,
  jobPronounOf,
  jobsTextOf,
  jobWaitVerbOf,
  pendingReasonTextOf,
  situationTextOf,
} from "./fix-cause-text";

function noTaker(overrides: Partial<NoTakerItem>): NoTakerItem {
  return {
    kind: "no_taker",
    state: "Pending",
    intent: "implement",
    tags: [],
    jobCount: 1,
    ...overrides,
  } as unknown as NoTakerItem;
}

describe("jobsTextOf", () => {
  it("names one job without tags", () => {
    expect(jobsTextOf(noTaker({}))).toBe("implement job in state Pending");
  });

  it("names several jobs with their tags", () => {
    expect(jobsTextOf(noTaker({ jobCount: 2, tags: ["gpu", "arm"] }))).toBe(
      "implement jobs in state Pending with the tags gpu, arm",
    );
  });
});

describe("job agreement", () => {
  it("uses the singular for one job", () => {
    expect(jobPronounOf(1)).toBe("it");
    expect(jobWaitVerbOf(1)).toBe("waits");
  });

  it("uses the plural for several jobs", () => {
    expect(jobPronounOf(3)).toBe("them");
    expect(jobWaitVerbOf(3)).toBe("wait");
  });
});

describe("situationTextOf", () => {
  it("gives the text of each taker situation", () => {
    expect(situationTextOf("no_instance")).toContain("lists no instance");
    expect(situationTextOf("no_registration")).toContain(
      "no live registration of a listed instance",
    );
    expect(situationTextOf("external_harness")).toBe(
      "has no live registration. Start its worker program.",
    );
  });
});

describe("exampleOf", () => {
  it("adds for example for a count above one", () => {
    expect(exampleOf({ count: 2 })).toBe(", for example");
    expect(exampleOf({ count: 1 })).toBe("");
  });
});

describe("issuesTextOf", () => {
  it("lists the issues in parentheses", () => {
    expect(issuesTextOf(["a", "b"])).toBe(" (a, b)");
  });

  it("gives no text without an issue", () => {
    expect(issuesTextOf([])).toBe("");
  });
});

describe("pendingReasonTextOf", () => {
  it("ends the sentence without a reason", () => {
    expect(pendingReasonTextOf("")).toBe(".");
  });

  it("appends the reason", () => {
    expect(pendingReasonTextOf("the clone runs")).toBe(": the clone runs");
  });
});
