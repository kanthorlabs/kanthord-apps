import { describe, expect, it } from "vitest";

import type { PlacementStatus } from "@/api/types";
import {
  containerDescriptionOf,
  instancePlacementNoteOf,
  instancePlacementText,
  placementChoicesOf,
  placementReasonText,
} from "./placement-status";

const ROOTLESS_DOCKER =
  "rootless Docker cannot map the container uid 10001 to the server user. Use rootless Podman or a rootful runtime.";

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
      "This server runs in a container, so it cannot start a container for the instance. Choose Server.",
    );
    expect(placementReasonText("runtime_absent", null, null)).toBe(
      "Install Podman or Docker on the server host, then open this sheet again.",
    );
  });

  it("names the rootful runtime when the server knows it", () => {
    expect(placementReasonText("runtime_rootful", null, "Podman")).toBe(
      "Podman runs as root on this host. Use rootless Podman.",
    );
    expect(placementReasonText("runtime_rootful", null, null)).toBe(
      "The container runtime runs as root on this host. Use rootless Podman.",
    );
  });

  it("puts the detail of a failed runtime before the action", () => {
    expect(placementReasonText("runtime_failed", "Cannot connect to Podman.", null)).toBe(
      "Cannot connect to Podman. Fix the container runtime of the server user, then open this sheet again.",
    );
    expect(placementReasonText("runtime_failed", null, null)).toBe(
      "The container runtime does not answer. Fix the container runtime of the server user, then open this sheet again.",
    );
  });

  it("puts the rootless Docker detail before the action", () => {
    expect(placementReasonText("runtime_failed", ROOTLESS_DOCKER, "Docker")).toBe(
      `${ROOTLESS_DOCKER} Fix the container runtime of the server user, then open this sheet again.`,
    );
  });
});

describe("instancePlacementText", () => {
  it("states one sentence for each stable reason", () => {
    expect(instancePlacementText("server_in_container", null, null)).toBe(
      "This server runs in a container, so it cannot start a container for the instance.",
    );
    expect(instancePlacementText("runtime_absent", null, null)).toBe(
      "Install Podman or Docker on the server host.",
    );
    expect(instancePlacementText("runtime_rootful", null, "Podman")).toBe(
      "Podman runs as root on this host. Use rootless Podman.",
    );
    expect(instancePlacementText("runtime_rootful", null, null)).toBe(
      "The container runtime runs as root on this host. Use rootless Podman.",
    );
  });

  it("puts the detail of a failed runtime before the retry", () => {
    expect(instancePlacementText("runtime_failed", ROOTLESS_DOCKER, "Docker")).toBe(
      `${ROOTLESS_DOCKER} The server retries the launch with a backoff.`,
    );
    expect(instancePlacementText("runtime_failed", null, null)).toBe(
      "The container runtime does not answer. The server retries the launch with a backoff.",
    );
  });

  it("ends each engine detail with one sentence mark before the retry", () => {
    const cases = [
      [
        "podman answers no host",
        "podman answers no host. The server retries the launch with a backoff.",
      ],
      ["docker info exits 1", "docker info exits 1. The server retries the launch with a backoff."],
      [
        "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?",
        "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running? The server retries the launch with a backoff.",
      ],
      [
        "docker client 20.10.0 is below 23. Upgrade the Docker client to 23 or later.",
        "docker client 20.10.0 is below 23. Upgrade the Docker client to 23 or later. The server retries the launch with a backoff.",
      ],
      ["Error: stopped ", "Error: stopped. The server retries the launch with a backoff."],
    ] as const;
    for (const [detail, text] of cases)
      expect(instancePlacementText("runtime_failed", detail, null)).toBe(text);
  });

  it("holds no sentence of the Add instance sheet", () => {
    const reasons = [
      "server_in_container",
      "runtime_absent",
      "runtime_failed",
      "runtime_rootful",
    ] as const;
    for (const reason of reasons)
      expect(instancePlacementText(reason, null, null)).not.toMatch(
        /open this sheet again|Choose Server/,
      );
  });
});

describe("instancePlacementNoteOf", () => {
  it("states no text while the list loads, after a failed read or when container is available", () => {
    expect(instancePlacementNoteOf("checking")).toBeNull();
    expect(instancePlacementNoteOf("failed")).toBeNull();
    expect(instancePlacementNoteOf(containerStatus({}))).toBeNull();
    expect(instancePlacementNoteOf([])).toBeNull();
  });

  it("states the instance text with the runtime label when container is not available", () => {
    expect(
      instancePlacementNoteOf(
        containerStatus({
          available: false,
          reason: "runtime_rootful",
          container_runtime: "docker",
        }),
      ),
    ).toBe("Docker runs as root on this host. Use rootless Podman.");
  });
});

describe("placementChoicesOf", () => {
  it("turns container off and names the check while the list loads", () => {
    expect(placementChoicesOf("checking")).toEqual({
      disabled: ["container"],
      note: "Checking the server host…",
      runtime: null,
    });
    expect(containerDescriptionOf(placementChoicesOf("checking"))).toBe(
      "Checking the server host…",
    );
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
      note: "Off. Docker runs as root on this host. Use rootless Podman.",
      runtime: "Docker",
    });
  });

  it("turns container off with the Choose Server reason when the server runs in a container", () => {
    expect(
      placementChoicesOf(
        containerStatus({
          available: false,
          reason: "server_in_container",
          container_runtime: null,
        }),
      ),
    ).toEqual({
      disabled: ["container"],
      note: "Off. This server runs in a container, so it cannot start a container for the instance. Choose Server.",
      runtime: null,
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
      note: "Stopped. Fix the container runtime of the server user, then open this sheet again.",
      runtime: null,
    });
  });

  it("turns container off with the reason when the list read failed", () => {
    expect(placementChoicesOf("failed")).toEqual({
      disabled: ["container"],
      note: "Off. The check of the server host failed. Open this sheet again.",
      runtime: null,
    });
  });

  it("turns nothing off when the list holds no container entry", () => {
    expect(placementChoicesOf([])).toEqual({ disabled: [], note: null, runtime: null });
  });
});

describe("containerDescriptionOf", () => {
  it("names the runtime that the server uses", () => {
    expect(containerDescriptionOf(placementChoicesOf(containerStatus({})))).toBe(
      "Runs the instance in its own container on the server host with Podman.",
    );
  });

  it("names no runtime when the server reports none", () => {
    expect(
      containerDescriptionOf(placementChoicesOf(containerStatus({ container_runtime: null }))),
    ).toBe("Runs the instance in its own container on the server host.");
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
      "Runs the instance in its own container on the server host. Stopped. Fix the container runtime of the server user, then open this sheet again.",
    );
  });
});
