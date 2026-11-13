import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { describe, expect, it } from "vitest";

import { useSheetClose } from "./use-sheet-close";

function clickOn(element: Element): MouseEvent<HTMLElement> {
  return { target: element } as unknown as MouseEvent<HTMLElement>;
}

function element(markup: string): Element {
  const host = document.createElement("div");
  host.innerHTML = markup;
  return host.firstElementChild as Element;
}

function openedHook() {
  const hook = renderHook(() => useSheetClose());
  act(() => hook.result.current.setOpen(true));
  return hook;
}

describe("useSheetClose", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useSheetClose());

    expect(result.current.open).toBe(false);
  });

  it.each([
    ["an enabled button", "<button>Reject</button>"],
    ["a link", '<a href="/trace">Trace</a>'],
    ["the child of a button", "<button><span>Reject</span></button>"],
  ])("closes when the click lands on %s", (_name, markup) => {
    const { result } = openedHook();
    const target = element(markup);

    act(() => result.current.closeOnAct(clickOn(target.querySelector("span") ?? target)));

    expect(result.current.open).toBe(false);
  });

  it.each([
    ["a disabled button", "<button disabled>Reject</button>"],
    ["a gated button", '<button aria-disabled="true">Reject</button>'],
    ["plain text", "<p>Reject</p>"],
  ])("stays open when the click lands on %s", (_name, markup) => {
    const { result } = openedHook();

    act(() => result.current.closeOnAct(clickOn(element(markup))));

    expect(result.current.open).toBe(true);
  });
});
