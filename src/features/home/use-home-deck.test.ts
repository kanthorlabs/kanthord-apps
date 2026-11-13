import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent, PointerEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/api/types";
import type { AttentionItem } from "@/lib/attention";
import { deckRowTextOf } from "@/lib/deck-card";
import type { FixAttentionItem } from "@/lib/fix-attention";

import { DECK_EXIT_MS, type HomeDeckInput, useHomeDeck } from "./use-home-deck";

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function fix(id: string, at: number): FixAttentionItem {
  return {
    id,
    kind: "project_paused",
    group: "fixes",
    project: PROJECT,
    projects: [PROJECT],
    at,
    subject: `Subject ${id}`,
    cause: "Project paused",
    nodeIds: [],
  };
}

const HELD = new Map<string, readonly string[]>();
const GATES = new Map();
const DETAILS = new Map();

function inputOf(items: readonly AttentionItem[]): HomeDeckInput {
  return {
    items,
    held: HELD,
    gates: GATES,
    details: DETAILS,
    now: 1_000,
    status: "ready",
    loaded: true,
    inbox: 0,
    readFault: false,
    setDialogOpen: vi.fn(),
  };
}

function mount(items: readonly AttentionItem[]) {
  return renderHook((props: HomeDeckInput) => useHomeDeck(props), {
    initialProps: inputOf(items),
  });
}

function idsOf(order: readonly AttentionItem[]): readonly string[] {
  return order.map((item) => item.id);
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useHomeDeck cursor", () => {
  it("sets the cursor to #1 at the first ready read and keeps the primary when a new item ranks first", () => {
    const first = fix("a", 200);
    const { result, rerender } = mount([first, fix("b", 300)]);

    expect(result.current.primary?.id).toBe("a");
    expect(result.current.rank).toBe(1);

    rerender(inputOf([first, fix("b", 300), fix("c", 100)]));

    expect(result.current.primary?.id).toBe("a");
    expect(result.current.rank).toBe(2);
    expect(idsOf(result.current.order)).toEqual(["c", "a", "b"]);
  });

  it("moves the cursor with step and changes no item, and stops at both ends", () => {
    const { result } = mount([fix("a", 100), fix("b", 200), fix("c", 300)]);
    const before = idsOf(result.current.order);

    act(() => result.current.step(-1));
    expect(result.current.primary?.id).toBe("a");
    expect(result.current.canPrevious).toBe(false);

    act(() => result.current.step(1));
    act(() => result.current.step(1));
    expect(result.current.primary?.id).toBe("c");
    expect(result.current.canNext).toBe(false);

    act(() => result.current.step(1));
    expect(result.current.primary?.id).toBe("c");

    act(() => result.current.step(-1));
    expect(result.current.primary?.id).toBe("b");
    expect(idsOf(result.current.order)).toEqual(before);
    expect(result.current.countText).toBe("2 of 3 waiting · 3 acts · No node waits");
  });

  it("moves the cursor to a selected item and closes the list", () => {
    const { result } = mount([fix("a", 100), fix("b", 200), fix("c", 300)]);

    act(() => result.current.toggleList());
    expect(result.current.list).not.toBeNull();
    act(() => result.current.select("c"));

    expect(result.current.primary?.id).toBe("c");
    expect(result.current.list).toBeNull();
  });
});

describe("useHomeDeck exit", () => {
  it("lets an acted item leave after 220 ms and gives the cursor to the same index", () => {
    const items = [fix("a", 100), fix("b", 200), fix("c", 300)];
    const { result, rerender } = mount(items);
    act(() => result.current.step(1));

    act(() => result.current.markActed("b"));

    expect(result.current.leaving).toBe(true);
    expect(result.current.primary?.id).toBe("b");
    advance(DECK_EXIT_MS - 1);
    expect(result.current.primary?.id).toBe("b");
    advance(1);

    expect(result.current.leaving).toBe(false);
    expect(result.current.primary?.id).toBe("c");
    expect(idsOf(result.current.order)).toEqual(["a", "c"]);
    expect(result.current.live).toBe("Done: Subject b · 2 items wait");

    rerender(inputOf([items[0] as AttentionItem, items[2] as AttentionItem]));

    expect(idsOf(result.current.order)).toEqual(["a", "c"]);
    expect(result.current.primary?.id).toBe("c");
  });

  it("moves the cursor to the last item when the acted item was the last", () => {
    const { result } = mount([fix("a", 100), fix("b", 200)]);
    act(() => result.current.step(1));

    act(() => result.current.markActed("b"));
    advance(DECK_EXIT_MS);

    expect(result.current.primary?.id).toBe("a");
    expect(result.current.live).toBe("Done: Subject b · 1 item waits");
  });

  it("shows the gone text for 1.5 s when a read drops the cursor item, then runs the same exit", () => {
    const items = [fix("a", 100), fix("b", 200), fix("c", 300)];
    const { result, rerender } = mount(items);
    act(() => result.current.step(1));

    rerender(inputOf([items[0] as AttentionItem, items[2] as AttentionItem]));

    expect(result.current.gone).toBe(true);
    expect(result.current.primary?.id).toBe("b");
    advance(1499);
    expect(result.current.gone).toBe(true);
    advance(1);

    expect(result.current.gone).toBe(false);
    expect(result.current.leaving).toBe(true);
    expect(result.current.primary?.id).toBe("b");
    advance(DECK_EXIT_MS);

    expect(result.current.leaving).toBe(false);
    expect(result.current.primary?.id).toBe("c");
    expect(result.current.live).toBe("Done: Subject b · 2 items wait");
  });

  it("skips the gone text and runs the exit at once for an item that closed a dialog with an act", () => {
    const items = [fix("a", 100), fix("b", 200), fix("c", 300)];
    const input = inputOf(items);
    const { result, rerender } = renderHook((props: HomeDeckInput) => useHomeDeck(props), {
      initialProps: input,
    });
    act(() => result.current.step(1));

    act(() => result.current.setDialogOpen("b", "node_b", false, { id: "unblock" }));
    expect(input.setDialogOpen).toHaveBeenCalledWith("b", "node_b", false);
    rerender(inputOf([items[0] as AttentionItem, items[2] as AttentionItem]));

    expect(result.current.gone).toBe(false);
    expect(result.current.leaving).toBe(true);
    advance(DECK_EXIT_MS);

    expect(result.current.primary?.id).toBe("c");
    expect(result.current.live).toBe("Done: Subject b · 2 items wait");
  });

  it("turns the gone text into the exit when the act arrives after the read dropped the item", () => {
    const items = [fix("a", 100), fix("b", 200), fix("c", 300)];
    const { result, rerender } = mount(items);
    act(() => result.current.step(1));
    rerender(inputOf([items[0] as AttentionItem, items[2] as AttentionItem]));
    expect(result.current.gone).toBe(true);

    act(() => result.current.setDialogOpen("b", "node_b", false, { id: "unblock" }));

    expect(result.current.gone).toBe(false);
    expect(result.current.leaving).toBe(true);
    advance(DECK_EXIT_MS);
    expect(result.current.primary?.id).toBe("c");
    expect(result.current.live).toBe("Done: Subject b · 2 items wait");
  });

  it("shows the gone text for an item that closed a dialog with no act", () => {
    const items = [fix("a", 100), fix("b", 200)];
    const { result, rerender } = mount(items);
    act(() => result.current.step(1));

    act(() => result.current.setDialogOpen("b", "node_b", false));
    rerender(inputOf([items[0] as AttentionItem]));

    expect(result.current.gone).toBe(true);
  });

  it("does nothing on step while an exit runs", () => {
    const { result } = mount([fix("a", 100), fix("b", 200)]);

    act(() => result.current.markActed("a"));
    act(() => result.current.step(1));
    advance(DECK_EXIT_MS);

    expect(result.current.primary?.id).toBe("b");
  });
});

describe("useHomeDeck keys", () => {
  function keyEvent(key: string, target: Element, currentTarget: Element) {
    return {
      key,
      target,
      currentTarget,
      defaultPrevented: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent<HTMLElement>;
  }

  function surface() {
    const section = document.createElement("section");
    const input = document.createElement("input");
    section.append(input);
    return { section, input };
  }

  it("steps +1 on ArrowRight and -1 on ArrowLeft", () => {
    const { result } = mount([fix("a", 100), fix("b", 200), fix("c", 300)]);
    const { section } = surface();

    act(() => result.current.onKeyDown(keyEvent("ArrowRight", section, section)));
    expect(result.current.primary?.id).toBe("b");
    act(() => result.current.onKeyDown(keyEvent("ArrowLeft", section, section)));

    expect(result.current.primary?.id).toBe("a");
  });

  it("steps on no key inside a text input", () => {
    const { result } = mount([fix("a", 100), fix("b", 200)]);
    const { section, input } = surface();

    act(() => result.current.onKeyDown(keyEvent("ArrowRight", input, section)));

    expect(result.current.primary?.id).toBe("a");
  });

  it("closes the open list with Esc", () => {
    const { result } = mount([fix("a", 100)]);
    const { section, input } = surface();
    act(() => result.current.toggleList());

    act(() => result.current.onKeyDown(keyEvent("Escape", input, section)));

    expect(result.current.list).toBeNull();
  });
});

describe("useHomeDeck swipe", () => {
  function touch(clientX: number, clientY: number, timeStamp = 0) {
    return { pointerType: "touch", clientX, clientY, timeStamp } as unknown as PointerEvent;
  }

  it("steps +1 on a touch swipe of 60 px to the left", () => {
    const { result } = mount([fix("a", 100), fix("b", 200)]);

    act(() => result.current.swipe.onPointerDown(touch(200, 100)));
    act(() => result.current.swipe.onPointerUp(touch(140, 105)));

    expect(result.current.primary?.id).toBe("b");
  });

  it("does nothing on a swipe of 20 px", () => {
    const { result } = mount([fix("a", 100), fix("b", 200)]);

    act(() => result.current.swipe.onPointerDown(touch(200, 100)));
    act(() => result.current.swipe.onPointerUp(touch(180, 100)));

    expect(result.current.primary?.id).toBe("a");
  });

  it("does nothing when the move is mostly vertical or not a touch", () => {
    const { result } = mount([fix("a", 100), fix("b", 200)]);

    act(() => result.current.swipe.onPointerDown(touch(200, 100)));
    act(() => result.current.swipe.onPointerUp(touch(140, 300)));
    act(() =>
      result.current.swipe.onPointerDown({
        pointerType: "mouse",
        clientX: 200,
        clientY: 100,
      } as unknown as PointerEvent),
    );
    act(() => result.current.swipe.onPointerUp(touch(100, 100)));

    expect(result.current.primary?.id).toBe("a");
  });
});

describe("useHomeDeck secondary tab", () => {
  it("carries the short tab text of the secondary item", () => {
    const { result } = mount([fix("a", 100), fix("b", 200)]);

    expect(result.current.secondary?.tab).toBe(deckRowTextOf(fix("b", 200), DETAILS, 1_000).tab);
    expect(result.current.secondary?.tab).not.toBe("");
  });
});

describe("useHomeDeck new mark", () => {
  it("marks an item that ranks right after the primary until the cursor reaches it", () => {
    const first = fix("a", 100);
    const last = fix("z", 900);
    const { result, rerender } = mount([first, last]);
    expect(result.current.secondary?.isNew).toBe(false);

    rerender(inputOf([first, last, fix("n", 150)]));

    expect(result.current.secondary).toMatchObject({ rank: 2, isNew: true });
    expect(result.current.secondary?.item.id).toBe("n");

    act(() => result.current.step(1));

    expect(result.current.primary?.id).toBe("n");
    expect(result.current.secondary).toMatchObject({ isNew: false });

    act(() => result.current.step(-1));

    expect(result.current.secondary?.item.id).toBe("n");
    expect(result.current.secondary?.isNew).toBe(false);
  });
});

describe("useHomeDeck first answers", () => {
  it("marks no item new that arrives before the first answer of the other reads", () => {
    const first = fix("a", 100);
    const last = fix("z", 900);
    const { result, rerender } = renderHook((props: HomeDeckInput) => useHomeDeck(props), {
      initialProps: { ...inputOf([first, last]), loaded: false },
    });
    rerender({ ...inputOf([first, last, fix("n", 150)]), loaded: false });
    rerender(inputOf([first, last, fix("n", 150)]));

    expect(result.current.secondary).toMatchObject({ rank: 2, isNew: false });
  });

  it("holds the first known set until the other reads answer", () => {
    const first = fix("a", 100);
    const last = fix("z", 900);
    const unloaded = { ...inputOf([first, last]), loaded: false };
    const { result, rerender } = renderHook((props: HomeDeckInput) => useHomeDeck(props), {
      initialProps: unloaded,
    });
    rerender(inputOf([first, last]));
    rerender(inputOf([first, last, fix("n", 150)]));

    expect(result.current.secondary).toMatchObject({ rank: 2, isNew: true });
  });
});

describe("useHomeDeck first", () => {
  it("selects the first item of the order", () => {
    const { result } = mount([fix("a", 100), fix("b", 200)]);
    act(() => result.current.step(1));

    act(() => result.current.selectFirst());

    expect(result.current.primary?.id).toBe("a");
  });

  it("counts the held nodes of the primary", () => {
    const held = new Map([["a", ["n1", "n2"]]]);
    const { result } = renderHook((props: HomeDeckInput) => useHomeDeck(props), {
      initialProps: { ...inputOf([fix("a", 100)]), held },
    });

    expect(result.current.primaryHeld).toBe(2);
  });
});

describe("useHomeDeck list", () => {
  it("resets shown with a new query or tab and adds a page with showMore", () => {
    const items = Array.from({ length: 120 }, (_, index) => fix(`item-${index}`, index + 1));
    const { result } = mount(items);

    act(() => result.current.toggleList());
    expect(result.current.list).toMatchObject({ shown: 50, count: 120, hasMore: true });
    act(() => result.current.showMore());
    expect(result.current.list?.shown).toBe(100);
    act(() => result.current.setQuery("item-1"));

    expect(result.current.list).toMatchObject({ query: "item-1", shown: 50 });
    act(() => result.current.showMore());
    act(() => result.current.setTab("setup"));
    expect(result.current.list).toMatchObject({ tab: "setup", shown: 50 });
  });
});
