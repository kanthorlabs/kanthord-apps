import { describe, expect, it } from "vitest";

import {
  addressDefaultOf,
  copyStepsOf,
  hostKindOf,
  instanceAddressError,
  instanceNameError,
  SAME_HOST_ADDRESS,
  shortFingerprint,
} from "./instance-host";

describe("instanceNameError", () => {
  it("accepts the binding name form", () => {
    expect(instanceNameError("mac-studio")).toBeNull();
  });

  it("names the form rule", () => {
    expect(instanceNameError("Mac")).toBe(
      "Start with a lowercase letter. Use only lowercase letters, digits and hyphens.",
    );
    expect(instanceNameError("")).toBe("Enter a name.");
    expect(instanceNameError(`a${"b".repeat(63)}`)).toBe("Use at most 63 characters.");
  });

  it("refuses each reserved name", () => {
    for (const name of ["server", "token", "connect", "heartbeat"]) {
      expect(instanceNameError(name)).toBe(`The name ${name} is reserved. Choose another name.`);
    }
  });
});

describe("instanceAddressError", () => {
  it("accepts an http or https URL", () => {
    expect(instanceAddressError("http://192.168.1.10:31415")).toBeNull();
    expect(instanceAddressError("https://kd.example.com")).toBeNull();
  });

  it("refuses an empty value and another scheme", () => {
    expect(instanceAddressError(" ")).toBe("Enter the address of the server.");
    expect(instanceAddressError("ftp://kd")).toMatch(/full http or https URL/);
  });
});

describe("addressDefaultOf", () => {
  it("fills the container network address for a same-host container", () => {
    expect(addressDefaultOf("Container on this host", "http://127.0.0.1:31415", true)).toEqual({
      address: SAME_HOST_ADDRESS,
      hint: null,
    });
  });

  it("fills the dashboard address for another host kind", () => {
    expect(addressDefaultOf("Linux (systemd)", "https://kd.example.com/", true)).toEqual({
      address: "https://kd.example.com",
      hint: null,
    });
  });

  it("leaves the field empty with a hint for a loopback dashboard address", () => {
    const value = addressDefaultOf("macOS (foreground)", "http://localhost:31415", false);
    expect(value.address).toBe("");
    expect(value.hint).toMatch(/loopback address/);
    expect(value.hint).toContain("http://192.168.1.10:<port>.");
  });

  it("uses the dashboard address for a same-host container when the server runs on the host", () => {
    expect(
      addressDefaultOf("Container on this host", "https://kd.example.com", false).address,
    ).toBe("https://kd.example.com");
  });
});

describe("copyStepsOf", () => {
  it("names the instance and the version in the systemd steps", () => {
    const steps = copyStepsOf("Linux (systemd)", "lan-01", "28.0.1");
    expect(steps[0]?.text).toContain("release 28.0.1");
    expect(steps.at(-1)?.command).toContain("kanthord-worker@lan-01");
    expect(steps.some((step) => step.command === "kanthord worker join")).toBe(true);
  });

  it("tells the human to press Enter before Ctrl-D in each paste step", () => {
    const steps = (["Linux (systemd)", "macOS (foreground)", "Container on this host"] as const)
      .flatMap((kind) => copyStepsOf(kind, "lan-01", "28.0.1"))
      .filter((step) => step.text.includes("Ctrl-D"));
    expect(steps).toHaveLength(3);
    for (const step of steps) {
      expect(step.text).toContain("Paste the value, press Enter, then press Ctrl-D");
    }
  });

  it("writes the systemd drop-in of the instance with the GIT_* variables and no core dumps", () => {
    const steps = copyStepsOf("Linux (systemd)", "lan-01", "28.0.1");
    const index = steps.findIndex((step) => step.command?.includes("kanthord.conf") === true);
    expect(steps[index]?.command).toBe(
      [
        "mkdir -p ~/.config/systemd/user/kanthord-worker@lan-01.service.d",
        "cat > ~/.config/systemd/user/kanthord-worker@lan-01.service.d/kanthord.conf <<'EOF'",
        "[Service]",
        'Environment="GIT_AUTHOR_NAME=<git name>" "GIT_AUTHOR_EMAIL=<git email>" "GIT_COMMITTER_NAME=<git name>" "GIT_COMMITTER_EMAIL=<git email>"',
        "LimitCORE=0",
        "EOF",
      ].join("\n"),
    );
    expect(index).toBe(steps.length - 2);
  });

  it("starts a foreground instance by name on macOS", () => {
    expect(copyStepsOf("macOS (foreground)", "mac-01", "28.0.1").at(-1)?.command).toBe(
      "kanthord serve worker --instance mac-01",
    );
  });

  it("exports the GIT_* variables before the macOS start", () => {
    expect(copyStepsOf("macOS (foreground)", "mac-01", "28.0.1").at(-2)?.command).toBe(
      'export GIT_AUTHOR_NAME="<git name>" GIT_AUTHOR_EMAIL="<git email>" GIT_COMMITTER_NAME="<git name>" GIT_COMMITTER_EMAIL="<git email>"',
    );
  });

  it("puts the configuration of a container in KANTHORD_WORKER_CONFIG and never on a command line", () => {
    const steps = copyStepsOf("Container", "box-01", "28.0.1");
    expect(steps[0]?.text).toContain("KANTHORD_WORKER_CONFIG");
    expect(steps.every((step) => step.command === null)).toBe(true);
    const sameHost = copyStepsOf("Container on this host", "box-01", "28.0.1");
    expect(sameHost[1]?.command).toBe("podman secret create kanthord-worker-box-01 -");
    expect(sameHost[2]?.command).toContain("docker.io/kanthorlabs/kanthord:28.0.1 serve worker");
  });
});

describe("hostKindOf", () => {
  it("answers only a known host kind", () => {
    expect(hostKindOf("Container")).toBe("Container");
    expect(hostKindOf("Windows")).toBeNull();
    expect(hostKindOf(null)).toBeNull();
  });
});

describe("shortFingerprint", () => {
  it("keeps the first 12 characters of the digest", () => {
    expect(shortFingerprint("SHA256:4l0bK2qPn8YwVx3JmT7rUe6Hs1Dc9GfZaR5iLoQyWkE")).toBe(
      "SHA256:4l0bK2qPn8Yw…",
    );
  });
});
