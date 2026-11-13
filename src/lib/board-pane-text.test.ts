import { describe, expect, it } from "vitest";

import { healthMessageOf } from "./board-pane-text";

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
