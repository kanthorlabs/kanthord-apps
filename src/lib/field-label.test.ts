import { describe, expect, it } from "vitest";

import { fieldLabel } from "./field-label";

describe("fieldLabel", () => {
  it("turns a camelCase or snake_case key into a Title Case label", () => {
    expect(fieldLabel("baseUrl")).toBe("Base URL");
    expect(fieldLabel("region")).toBe("Region");
    expect(fieldLabel("resource_name")).toBe("Resource Name");
    expect(fieldLabel("account_id")).toBe("Account ID");
    expect(fieldLabel("gateway_id")).toBe("Gateway ID");
  });
});
