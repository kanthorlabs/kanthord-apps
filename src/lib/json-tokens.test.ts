import { describe, expect, it } from "vitest";

import { jsonTokens } from "./json-tokens";

describe("jsonTokens", () => {
  it("pretty-prints a JSON object and marks each kind of token", () => {
    const tokens = jsonTokens('{"id":"project_1","count":2,"open":true,"parent":null}');

    expect(tokens?.map((token) => token.text).join("")).toBe(
      '{\n  "id": "project_1",\n  "count": 2,\n  "open": true,\n  "parent": null\n}',
    );
    expect(tokens?.filter((token) => token.kind !== "plain")).toEqual([
      { kind: "key", text: '"id"' },
      { kind: "string", text: '"project_1"' },
      { kind: "key", text: '"count"' },
      { kind: "number", text: "2" },
      { kind: "key", text: '"open"' },
      { kind: "literal", text: "true" },
      { kind: "key", text: '"parent"' },
      { kind: "literal", text: "null" },
    ]);
  });

  it("keeps numbers, colons and quotes inside a string value in that string", () => {
    const tokens = jsonTokens('["a: 1 \\"true\\" -2"]');

    expect(tokens?.filter((token) => token.kind !== "plain")).toEqual([
      { kind: "string", text: '"a: 1 \\"true\\" -2"' },
    ]);
  });

  it("leaves plain text and a bare JSON scalar to the plain rendering", () => {
    expect(jsonTokens("total 0\ndrwx------ 2 user staff")).toBeNull();
    expect(jsonTokens("42")).toBeNull();
    expect(jsonTokens('"text"')).toBeNull();
  });
});
