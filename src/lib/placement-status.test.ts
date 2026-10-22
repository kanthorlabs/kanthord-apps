import { describe, expect, it } from "vitest";

import type { PlacementStatus } from "@/api/types";
import {
  containerDescriptionOf,
  placementChoicesOf,
  placementReasonText,
} from "./placement-status";

function containerStatus(change: Partial<PlacementStatus>): readonly PlacementStatus[] {
  return [
    { placement: "server", available: true, reason: null, detail: null, container_runtime: null },
    {
      placement: "container",
      available: true,
      reason: null,
      detail: null,
      container_runtime: "podman",
      ...change,
    },
    { placement: "worker", available: true, reason: null, detail: null, container_runtime: null },
  ];
}

describe("placementReasonText", () => {
  it("states one sentence for each stable reason", () => {
    expect(placementReasonText("server_in_container", null, null)).toBe(
      "This server runs in a container, so it cannot start a container for each instance. Keep server.",
    );
    expect(placementReasonText("runtime_absent", null, null)).toBe(
      "Install Podman or Docker on the server host, then open this sheet again.",
    );
  });

  it("names the rootful runtime when the server knows it", () => {
    expect(placementReasonText("runtime_rootful", null, "Podman")).toBe(
      "Podman runs as root on this host. Use rootless Podman or rootless Docker.",
    );
    expect(placementReasonText("runtime_rootful", null, null)).toBe(
      "The container runtime runs as root on this host. Use rootless Podman or rootless Docker.",
    );
  });

  it("puts the detail of a failed runtime before the action", () => {
    expect(placementReasonText("runtime_failed", "Cannot connect to Podman.", null)).toBe(
      "Cannot connect to Podman. Start the container runtime, then open this sheet again.",
    );
    expect(placementReasonText("runtime_failed", null, null)).toBe(
      "The container runtime does not answer. Start the container runtime, then open this sheet again.",
    );
  });
});

describe("placementChoicesOf", () => {
  it("turns container off while the list loads", () => {
    expect(placementChoicesOf(null)).toEqual({
      disabled: ["container"],
      note: null,
      runtime: null,
    });
  });

  it("turns nothing off when every placement is available", () => {
    expect(placementChoicesOf(containerStatus({}))).toEqual({
      disabled: [],
      note: null,
      runtime: "Podman",
    });
  });

  it("turns container off with the reason for a stable reason", () => {
    expect(
      placementChoicesOf(
        containerStatus({
          available: false,
          reason: "runtime_rootful",
          container_runtime: "docker",
        }),
      ),
    ).toEqual({
      disabled: ["container"],
      note: "Off. Docker runs as root on this host. Use rootless Podman or rootless Docker.",
      runtime: "Docker",
    });
  });

  it("keeps container on and shows the detail for a failed runtime", () => {
    expect(
      placementChoicesOf(
        containerStatus({
          available: false,
          reason: "runtime_failed",
          detail: "Stopped.",
          container_runtime: null,
        }),
      ),
    ).toEqual({
      disabled: [],
      note: "Stopped. Start the container runtime, then open this sheet again.",
      runtime: null,
    });
  });

  it("turns nothing off when the list read failed", () => {
    expect(placementChoicesOf([])).toEqual({ disabled: [], note: null, runtime: null });
  });
});

describe("containerDescriptionOf", () => {
  it("names the runtime that the server uses", () => {
    expect(containerDescriptionOf(placementChoicesOf(containerStatus({})))).toBe(
      "Runs each instance in its own container on the server host with Podman.",
    );
  });

  it("states only the reason when container is off", () => {
    expect(
      containerDescriptionOf(
        placementChoicesOf(
          containerStatus({ available: false, reason: "runtime_absent", container_runtime: null }),
        ),
      ),
    ).toBe("Off. Install Podman or Docker on the server host, then open this sheet again.");
  });

  it("adds the detail of a failed runtime to the description", () => {
    expect(
      containerDescriptionOf(
        placementChoicesOf(
          containerStatus({
            available: false,
            reason: "runtime_failed",
            detail: "Stopped.",
            container_runtime: null,
          }),
        ),
      ),
    ).toBe(
      "Runs each instance in its own container on the server host. Stopped. Start the container runtime, then open this sheet again.",
    );
  });
});
