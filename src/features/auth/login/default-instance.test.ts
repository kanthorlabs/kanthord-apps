import { afterEach, describe, expect, it, vi } from "vitest";

import { blankInstanceDraft, defaultBaseUrl, firstInstanceDraft } from "./default-instance";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("default instance", () => {
  it("points a development build at the daemon port of the page host", () => {
    vi.stubEnv("PROD", false);
    expect(defaultBaseUrl()).toBe("http://localhost:31415");
    expect(firstInstanceDraft()).toEqual({
      name: "localhost",
      baseUrl: "http://localhost:31415",
      token: "",
    });
  });

  it("keeps the daemon port for an IP address in a development build", () => {
    vi.stubEnv("PROD", false);
    vi.stubGlobal("location", new URL("http://192.168.1.64:27182/login"));
    expect(firstInstanceDraft()).toEqual({
      name: "192.168.1.64",
      baseUrl: "http://192.168.1.64:31415",
      token: "",
    });
  });

  it("leaves the port to the proxy for a domain name in a development build", () => {
    vi.stubEnv("PROD", false);
    vi.stubGlobal("location", new URL("https://kanthord.kanthorlabs.com/login"));
    expect(blankInstanceDraft()).toEqual({
      name: "",
      baseUrl: "https://kanthord.kanthorlabs.com",
      token: "",
    });
  });

  it("points a production build at the origin that served the page", () => {
    vi.stubEnv("PROD", true);
    expect(defaultBaseUrl()).toBe(window.location.origin);
    expect(firstInstanceDraft()).toEqual({
      name: window.location.hostname,
      baseUrl: window.location.origin,
      token: "",
    });
    expect(blankInstanceDraft()).toEqual({ name: "", baseUrl: window.location.origin, token: "" });
  });
});
