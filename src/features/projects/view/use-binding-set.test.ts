import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as projectsApi from "@/api/resources/projects";
import type { BindingSetEntry } from "@/api/types";

vi.mock("@/api/resources/projects");

import { useBindingSet } from "./use-binding-set";

const PROJECT_ID = "prj-1";
const PATH = `/projects/${PROJECT_ID}`;

const WORKER: BindingSetEntry = {
  kind: "worker",
  config: { worker: "coder@1", instance_count: 1 },
};

function mount(state: unknown) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [{ pathname: PATH, state }] }, children);
  return renderHook(
    () => ({ bindings: useBindingSet(PROJECT_ID, () => undefined), location: useLocation() }),
    { wrapper },
  );
}

describe("useBindingSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({ version: 1, bindings: {} });
    vi.mocked(projectsApi.writeBindingSet).mockResolvedValue({
      project_id: PROJECT_ID,
      binding_set_version: 2,
      changes: [{ kind: "created", binding_id: "binding-1" }],
    });
  });

  it("returns to the path of the router state after the save", async () => {
    const { result } = mount({ return_to: "/" });
    await waitFor(() => expect(result.current.bindings.resource.data).not.toBeNull());
    const onWritten = vi.fn();

    act(() => result.current.bindings.write("general-main", WORKER, onWritten));

    await waitFor(() => expect(result.current.location.pathname).toBe("/"));
    expect(onWritten).toHaveBeenCalledOnce();
  });

  it("stays on the project after the save without a return path", async () => {
    const { result } = mount(null);
    await waitFor(() => expect(result.current.bindings.resource.data).not.toBeNull());
    const onWritten = vi.fn();

    act(() => result.current.bindings.write("general-main", WORKER, onWritten));

    await waitFor(() => expect(onWritten).toHaveBeenCalledOnce());
    expect(result.current.location.pathname).toBe(PATH);
  });
});
