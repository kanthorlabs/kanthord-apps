import { describe, expect, it } from "vitest";

import { bindingNameOf } from "./execution-claimant";

const CLAIMANT = {
  worker_binding_id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BW1",
  resource_identity: "worker:kanthord:general-main",
  runtime_identity: "worker_registration_01J9ZQ4XKM3B6V8N2R5T7W0I00",
};

describe("bindingNameOf", () => {
  it("reads the binding name at the end of the resource identity", () => {
    expect(bindingNameOf(CLAIMANT)).toBe("general-main");
  });

  it("answers the whole text when it holds no colon", () => {
    expect(bindingNameOf({ ...CLAIMANT, resource_identity: "general-main" })).toBe("general-main");
  });
});
