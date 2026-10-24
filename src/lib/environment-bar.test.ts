import { describe, expect, it } from "vitest";

import type { EnvironmentState, EnvironmentStatus } from "@/api/types";
import {
  elapsedText,
  environmentPollMs,
  environmentSourceText,
  environmentStatusLabel,
  environmentStatusVariant,
  moreCountOf,
  needsRepairHint,
  repairText,
  shownEnvironmentOf,
  stepElapsedOf,
  stepLineOf,
  stepProgressOf,
  storableSource,
} from "./environment-bar";

function state(overrides: Partial<EnvironmentState> = {}): EnvironmentState {
  return {
    binding_id: "binding_1",
    binding_name: "engine",
    resource_identity: "resource_1",
    target: "image",
    source: "repository",
    status: "building",
    digest: null,
    tag: null,
    run_started_at: 1_000,
    step_started_at: 1_000,
    reason: null,
    failure: null,
    checks: [],
    repairs: 0,
    repairing: false,
    ...overrides,
  };
}

function failedState(overrides: Partial<EnvironmentState> = {}): EnvironmentState {
  return state({
    status: "failed",
    failure: {
      class: "command_absent",
      origin: "onboarding",
      execution_id: null,
      command: "pnpm",
      exit_code: null,
      tail: "",
      reproduce: "",
      ended_at: 2_000,
    },
    ...overrides,
  });
}

describe("shownEnvironmentOf", () => {
  it("answers the first failed state in list order over an earlier building state", () => {
    const states = [
      state({ binding_id: "a", status: "building" }),
      failedState({ binding_id: "b" }),
      failedState({ binding_id: "c" }),
    ];

    expect(shownEnvironmentOf(states)?.binding_id).toBe("b");
  });

  it("answers the active state with the earliest run start when none failed", () => {
    const states = [
      state({ binding_id: "a", status: "building", run_started_at: 5_000 }),
      state({ binding_id: "b", status: "proving", run_started_at: 2_000 }),
      state({ binding_id: "c", status: "pending", run_started_at: null }),
    ];

    expect(shownEnvironmentOf(states)?.binding_id).toBe("b");
  });

  it("sorts a queued run after every started run", () => {
    const states = [
      state({ binding_id: "a", status: "building", run_started_at: null }),
      state({ binding_id: "b", status: "building", run_started_at: 9_000 }),
    ];

    expect(shownEnvironmentOf(states)?.binding_id).toBe("b");
  });

  it("answers the first state of a tie on the run start", () => {
    const states = [
      state({ binding_id: "a", status: "building", run_started_at: null }),
      state({ binding_id: "b", status: "pending", run_started_at: null }),
    ];

    expect(shownEnvironmentOf(states)?.binding_id).toBe("a");
  });

  it("answers null with only none and ready states", () => {
    const states = [state({ status: "none" }), state({ binding_id: "b", status: "ready" })];

    expect(shownEnvironmentOf(states)).toBeNull();
    expect(shownEnvironmentOf([])).toBeNull();
  });
});

describe("moreCountOf", () => {
  it("counts the other states that are not none or ready", () => {
    const shown = failedState({ binding_id: "a" });
    const states = [
      shown,
      state({ binding_id: "b", status: "building" }),
      state({ binding_id: "c", status: "pending" }),
      state({ binding_id: "d", status: "ready" }),
      state({ binding_id: "e", status: "none" }),
    ];

    expect(moreCountOf(states, shown)).toBe(2);
  });

  it("answers 0 for a single state", () => {
    const shown = state();

    expect(moreCountOf([shown], shown)).toBe(0);
  });
});

describe("stepLineOf", () => {
  it.each([
    ["pending", "Reading the repository"],
    ["building", "Building the image"],
    ["proving", "Proving on the base branch head"],
    ["ready", "Ready"],
  ] satisfies [EnvironmentStatus, string][])("answers the step line of %s", (status, line) => {
    expect(stepLineOf(state({ status }))).toBe(line);
  });

  it("answers the class and the command of a failed state", () => {
    expect(stepLineOf(failedState())).toBe("Failed: command_absent · pnpm");
  });

  it("answers the reason of a pending state", () => {
    expect(
      stepLineOf(state({ status: "pending", reason: "The base branch main is absent." })),
    ).toBe("Waiting: The base branch main is absent.");
  });

  it("answers the step line of a pending state without a reason", () => {
    expect(stepLineOf(state({ status: "pending", run_started_at: null }))).toBe(
      "Reading the repository",
    );
  });

  it.each(["building", "proving"] satisfies EnvironmentStatus[])(
    "answers the queue wait of a %s state with no run start",
    (status) => {
      expect(stepLineOf(state({ status, run_started_at: null }))).toBe("Waiting for another run");
    },
  );
});

describe("repair", () => {
  it.each(["failed", "building", "proving"] satisfies EnvironmentStatus[])(
    "answers the repair line of a repairing %s state",
    (status) => {
      expect(stepLineOf(state({ status, repairing: true, repairs: 2 }))).toBe(
        "Repairing with env@1 · repair 2 of 3",
      );
    },
  );

  it("keeps the failure line of a failed state that does not repair", () => {
    expect(stepLineOf(failedState({ repairing: false, repairs: 2 }))).toBe(
      "Failed: command_absent · pnpm",
    );
  });

  it("answers the repair text of a state with repairs", () => {
    expect(repairText(2)).toBe("repair 2 of 3");
    expect(repairText(0)).toBeNull();
  });

  it("asks for the hint of a failed state with no repair and no enabled env@1", () => {
    expect(needsRepairHint(failedState(), false)).toBe(true);
    expect(needsRepairHint(failedState(), true)).toBe(false);
    expect(needsRepairHint(failedState(), null)).toBe(false);
    expect(needsRepairHint(failedState({ repairing: true }), false)).toBe(false);
    expect(needsRepairHint(state({ status: "building" }), false)).toBe(false);
  });
});

describe("stepProgressOf", () => {
  it("answers the step of the image target", () => {
    expect(stepProgressOf(state({ status: "pending" }))).toEqual({ step: 1, of: 3 });
    expect(stepProgressOf(state({ status: "building" }))).toEqual({ step: 2, of: 3 });
    expect(stepProgressOf(state({ status: "proving" }))).toEqual({ step: 3, of: 3 });
    expect(stepProgressOf(state({ status: "ready" }))).toEqual({ step: 3, of: 3 });
  });

  it("answers the step of the host target", () => {
    expect(stepProgressOf(state({ target: "host", status: "pending" }))).toEqual({
      step: 1,
      of: 2,
    });
    expect(stepProgressOf(state({ target: "host", status: "proving" }))).toEqual({
      step: 2,
      of: 2,
    });
    expect(stepProgressOf(state({ target: "host", status: "ready" }))).toEqual({
      step: 2,
      of: 2,
    });
  });

  it("answers null for a failed state, the remote target and a build at the host target", () => {
    expect(stepProgressOf(failedState())).toBeNull();
    expect(stepProgressOf(state({ target: "remote", status: "proving" }))).toBeNull();
    expect(stepProgressOf(state({ target: "host", status: "building" }))).toBeNull();
    expect(stepProgressOf(state({ status: "none" }))).toBeNull();
  });
});

describe("elapsedText", () => {
  it("answers null for a null time", () => {
    expect(elapsedText(null, 10_000)).toBeNull();
  });

  it("answers seconds under one minute", () => {
    expect(elapsedText(0, 45_000)).toBe("45 s");
    expect(elapsedText(0, 59_999)).toBe("59 s");
  });

  it("answers whole minutes from one minute", () => {
    expect(elapsedText(0, 60_000)).toBe("1 min");
    expect(elapsedText(0, 150_000)).toBe("2 min");
  });

  it("answers 0 s for a time after now", () => {
    expect(elapsedText(5_000, 1_000)).toBe("0 s");
  });
});

describe("stepElapsedOf", () => {
  it("answers the elapsed time of the step of a started run", () => {
    expect(stepElapsedOf(state({ step_started_at: 0 }), 120_000)).toBe("2 min");
  });

  it("answers null for a queued run, a failed state and a ready state", () => {
    expect(stepElapsedOf(state({ run_started_at: null, step_started_at: 0 }), 5_000)).toBeNull();
    expect(stepElapsedOf(failedState({ step_started_at: 0 }), 5_000)).toBeNull();
    expect(stepElapsedOf(state({ status: "ready", step_started_at: 0 }), 5_000)).toBeNull();
  });
});

describe("environmentPollMs", () => {
  it.each(["pending", "building", "proving"] satisfies EnvironmentStatus[])(
    "answers 5000 with a %s state",
    (status) => {
      expect(environmentPollMs([state({ status: "ready" }), state({ status })])).toBe(5000);
    },
  );

  it("answers 30000 otherwise", () => {
    expect(environmentPollMs(null)).toBe(30000);
    expect(environmentPollMs([])).toBe(30000);
    expect(environmentPollMs([failedState(), state({ status: "ready" })])).toBe(30000);
  });
});

describe("environment status presentation", () => {
  it("labels every status", () => {
    expect(environmentStatusLabel("pending")).toBe("Pending");
    expect(environmentStatusLabel("building")).toBe("Building");
    expect(environmentStatusLabel("proving")).toBe("Proving");
    expect(environmentStatusLabel("ready")).toBe("Ready");
    expect(environmentStatusLabel("failed")).toBe("Failed");
    expect(environmentStatusLabel("none")).toBe("None");
  });

  it("picks a stock badge variant", () => {
    expect(environmentStatusVariant("failed")).toBe("destructive");
    expect(environmentStatusVariant("ready")).toBe("outline");
    expect(environmentStatusVariant("none")).toBe("outline");
    expect(environmentStatusVariant("building")).toBe("secondary");
    expect(environmentStatusVariant("pending")).toBe("secondary");
    expect(environmentStatusVariant("proving")).toBe("secondary");
  });
});

describe("environmentSourceText", () => {
  it("explains each source", () => {
    expect(environmentSourceText("stored")).toBe("Stored on the binding.");
    expect(environmentSourceText("repository")).toBe(
      "Read from .devcontainer/devcontainer.json at the base-branch head.",
    );
    expect(environmentSourceText("detected")).toBe(
      "Drafted by KanthorD from the version files, the lockfiles and the CI workflows. Store it to keep and edit it.",
    );
    expect(environmentSourceText("universal")).toBe(
      "The universal environment of KanthorD. Detection found no stack. Store it to keep and edit it.",
    );
    expect(environmentSourceText("none")).toBe("No source applies to the target.");
  });
});

describe("storableSource", () => {
  it("is true for detected and universal only", () => {
    expect(storableSource("detected")).toBe(true);
    expect(storableSource("universal")).toBe(true);
    expect(storableSource("stored")).toBe(false);
    expect(storableSource("repository")).toBe(false);
    expect(storableSource("none")).toBe(false);
  });
});
