import { describe, expect, it } from "vitest";

import { loadInstances, saveInstances } from "./instance-storage";

const LOCAL = { id: "i-1", name: "local", baseUrl: "http://localhost:31415", token: "jwt-1" };

describe("instance storage", () => {
  it("reads an empty list when nothing is stored", () => {
    expect(loadInstances()).toEqual([]);
  });

  it("reads an empty list when the stored data is corrupt", () => {
    window.localStorage.setItem("kanthord.instances", "{not json");
    expect(loadInstances()).toEqual([]);
  });

  it("reads back what it saved, token included", () => {
    saveInstances([LOCAL]);
    expect(loadInstances()).toEqual([LOCAL]);
  });

  it("drops an entry that is not a saved instance", () => {
    window.localStorage.setItem(
      "kanthord.instances",
      JSON.stringify({
        instances: [LOCAL, { id: 7 }, { id: "i-2", name: "old", baseUrl: "http://old" }],
      }),
    );
    expect(loadInstances()).toEqual([LOCAL]);
  });
});
