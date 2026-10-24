import { describe, expect, it } from "vitest";

import { parseEnvironmentDocument } from "./environment-document";

describe("parseEnvironmentDocument", () => {
  it("returns a JSON object", () => {
    expect(parseEnvironmentDocument('{ "image": "x" }')).toEqual({ image: "x" });
  });

  it.each(["[1, 2]", "null", "1", '"x"', "{", "", '{ "a": 1, }', "// c\n{}"])(
    "returns null for %j",
    (text) => {
      expect(parseEnvironmentDocument(text)).toBeNull();
    },
  );
});
