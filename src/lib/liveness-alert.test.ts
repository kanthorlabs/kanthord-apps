import { describe, expect, it } from "vitest";

import { unavailableComponentsOf } from "./liveness-alert";

describe("unavailableComponentsOf", () => {
  it("names each component check that answers 503", () => {
    expect(
      unavailableComponentsOf({
        healthy: false,
        services: {
          server: { gateway: 200, store: 503, log: 503 },
          worker: { registrations: 200 },
          mission: { operations: 503 },
        },
      }),
    ).toEqual([
      "server.store unavailable",
      "server.log unavailable",
      "mission.operations unavailable",
    ]);
  });

  it("names nothing when every check answers 200", () => {
    expect(
      unavailableComponentsOf({ healthy: true, services: { server: { gateway: 200 } } }),
    ).toEqual([]);
  });
});
