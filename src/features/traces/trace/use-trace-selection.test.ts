import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useTraceSelection } from "./use-trace-selection";

function mountSelection(entries: readonly string[]) {
  const wrapper = ({ children }: { readonly children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [...entries] }, children);
  return renderHook(
    () => ({
      selection: useTraceSelection(),
      location: useLocation(),
      navigate: useNavigate(),
    }),
    { wrapper },
  );
}

describe("useTraceSelection", () => {
  it("opens the steps tab by default", () => {
    const { result } = mountSelection(["/traces/t1"]);

    expect(result.current.selection.tab).toBe("steps");
  });

  it("reads the old tab value span_tree as steps", () => {
    const { result } = mountSelection(["/traces/t1?tab=span_tree"]);

    expect(result.current.selection.tab).toBe("steps");
  });

  it("reads an unknown tab value as steps", () => {
    const { result } = mountSelection(["/traces/t1?tab=timeline"]);

    expect(result.current.selection.tab).toBe("steps");
  });

  it("keeps the conversation tab", () => {
    const { result } = mountSelection(["/traces/t1?tab=conversation"]);

    expect(result.current.selection.tab).toBe("conversation");
  });

  it("pushes a history entry when selectSpan opens the first span", () => {
    const { result } = mountSelection(["/home", "/traces/t1"]);

    act(() => result.current.selection.selectSpan("a"));
    expect(result.current.location.search).toBe("?tab=steps&span=a");

    act(() => result.current.navigate(-1));
    expect(result.current.location.pathname).toBe("/traces/t1");
    expect(result.current.location.search).toBe("");
  });

  it("pushes a history entry when showInTimeline opens the first span", () => {
    const { result } = mountSelection(["/home", "/traces/t1?tab=conversation"]);

    act(() => result.current.selection.showInTimeline("a"));
    expect(result.current.location.search).toBe("?tab=steps&span=a");

    act(() => result.current.navigate(-1));
    expect(result.current.location.search).toBe("?tab=conversation");
  });

  it("replaces the history entry when the span changes", () => {
    const { result } = mountSelection(["/home", "/traces/t1?tab=steps&span=a"]);

    act(() => result.current.selection.selectSpan("b"));
    expect(result.current.location.search).toBe("?tab=steps&span=b");

    act(() => result.current.navigate(-1));
    expect(result.current.location.pathname).toBe("/home");
  });

  it("replaces the history entry when showInTimeline changes the span", () => {
    const { result } = mountSelection(["/home", "/traces/t1?tab=steps&span=a"]);

    act(() => result.current.selection.showInTimeline("b"));

    act(() => result.current.navigate(-1));
    expect(result.current.location.pathname).toBe("/home");
  });

  it("replaces the history entry when the span closes", () => {
    const { result } = mountSelection(["/home", "/traces/t1?tab=steps&span=a"]);

    act(() => result.current.selection.selectSpan(null));
    expect(result.current.location.search).toBe("?tab=steps");

    act(() => result.current.navigate(-1));
    expect(result.current.location.pathname).toBe("/home");
  });

  it("replaces the history entry when the tab changes", () => {
    const { result } = mountSelection(["/home", "/traces/t1"]);

    act(() => result.current.selection.selectTab("conversation"));
    expect(result.current.location.search).toBe("?tab=conversation");

    act(() => result.current.navigate(-1));
    expect(result.current.location.pathname).toBe("/home");
  });
});
