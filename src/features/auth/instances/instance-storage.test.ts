import { describe, expect, it } from "vitest";

import { loadInstanceStore, saveInstanceStore } from "./instance-storage";

const LOCAL = { id: "i-1", name: "local", baseUrl: "http://localhost:31415" };

describe("instance storage", () => {
  it("reads an empty list when nothing is stored", () => {
    expect(loadInstanceStore()).toEqual({ instances: [], defaultId: null });
  });

  it("reads an empty list when the stored data is corrupt", () => {
    window.localStorage.setItem("kanthord.instances", "{not json");
    expect(loadInstanceStore()).toEqual({ instances: [], defaultId: null });
  });

  it("reads back what it saved", () => {
    saveInstanceStore({ instances: [LOCAL], defaultId: "i-1" });
    expect(loadInstanceStore()).toEqual({ instances: [LOCAL], defaultId: "i-1" });
  });

  it("drops a default that names no stored instance", () => {
    saveInstanceStore({ instances: [LOCAL], defaultId: "i-gone" });
    expect(loadInstanceStore()).toEqual({ instances: [LOCAL], defaultId: null });
  });

  it("drops an entry that is not an instance", () => {
    window.localStorage.setItem(
      "kanthord.instances",
      JSON.stringify({ instances: [LOCAL, { id: 7 }], defaultId: null }),
    );
    expect(loadInstanceStore().instances).toEqual([LOCAL]);
  });
});
