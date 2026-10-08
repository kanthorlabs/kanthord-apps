import { afterEach, describe, expect, it, vi } from "vitest";

import { blankInstanceDraft, defaultBaseUrl, firstInstanceDraft } from "./default-instance";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("default instance", () => {
  it("points a development build at the local daemon", () => {
    vi.stubEnv("PROD", false);
    expect(defaultBaseUrl()).toBe("http://localhost:31415");
    expect(firstInstanceDraft()).toEqual({
      name: "localhost",
      baseUrl: "http://localhost:31415",
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
