import { describe, expect, it } from "vitest";

import { BOARD_TAB } from "./board-tabs";
import { boardParamsOf, boardUrlOf } from "./board-url";

describe("boardUrlOf", () => {
  it("reads the project, the kind and the item", () => {
    const params = new URLSearchParams("project=prj-1&kind=paused&item=paused%3An1");

    expect(boardUrlOf(params)).toEqual({
      project: "prj-1",
      kind: BOARD_TAB.Resume,
      item: "paused:n1",
    });
  });

  it("answers null for each absent param", () => {
    expect(boardUrlOf(new URLSearchParams())).toEqual({ project: null, kind: null, item: null });
  });

  it("answers null for an unknown kind", () => {
    expect(boardUrlOf(new URLSearchParams("kind=unknown")).kind).toBeNull();
  });

  it("answers null for an empty value", () => {
    expect(boardUrlOf(new URLSearchParams("project=&kind=&item="))).toEqual({
      project: null,
      kind: null,
      item: null,
    });
  });
});

describe("boardParamsOf", () => {
  it("sets each value that is not null", () => {
    const next = boardParamsOf(new URLSearchParams(), {
      project: "prj-1",
      kind: BOARD_TAB.Tool,
      item: "tool_approval:s1",
    });

    expect(next.toString()).toBe("project=prj-1&kind=tool&item=tool_approval%3As1");
  });

  it("drops each null and keeps every other param", () => {
    const current = new URLSearchParams("project=prj-1&kind=tool&item=a&tab=bindings");

    const next = boardParamsOf(current, { project: null, kind: BOARD_TAB.Setup, item: null });

    expect(next.toString()).toBe("kind=setup&tab=bindings");
  });

  it("leaves the current params unchanged", () => {
    const current = new URLSearchParams("project=prj-1");

    boardParamsOf(current, { project: null, kind: null, item: null });

    expect(current.toString()).toBe("project=prj-1");
  });
});
