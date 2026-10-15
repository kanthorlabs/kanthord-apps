import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useScopedProject } from "./use-scoped-project";

function render(entry: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ scoped: useScopedProject(), location: useLocation() }), { wrapper });
}

describe("useScopedProject", () => {
  it("answers null for all projects when the search parameter is absent", () => {
    const view = render("/scheduler");

    expect(view.result.current.scoped.projectId).toBeNull();
  });

  it("reads the project search parameter", () => {
    const view = render("/scheduler?project=prj-2");

    expect(view.result.current.scoped.projectId).toBe("prj-2");
  });

  it("writes the project and keeps the other parameters", () => {
    const view = render("/scheduler?tab=done");

    act(() => view.result.current.scoped.select("prj-1"));

    expect(view.result.current.scoped.projectId).toBe("prj-1");
    expect(view.result.current.location.search).toBe("?tab=done&project=prj-1");
  });

  it("removes the parameter when the human picks all projects", () => {
    const view = render("/scheduler?project=prj-1");

    act(() => view.result.current.scoped.select(null));

    expect(view.result.current.scoped.projectId).toBeNull();
    expect(view.result.current.location.search).toBe("");
  });
});
