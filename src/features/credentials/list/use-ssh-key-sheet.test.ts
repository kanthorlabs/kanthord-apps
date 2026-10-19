import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useSshKeySheet } from "./use-ssh-key-sheet";

function wrapperAt(state: unknown, hash = "") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/repositories", hash, state }] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: "/repositories", element: children }),
        createElement(Route, { path: "/", element: createElement("p", null, "Onboarding") }),
      ),
    );
  };
}

function renderSheet(reload: () => void, state: unknown, hash = "") {
  return renderHook(
    () => ({ sheet: useSshKeySheet("repository", reload), location: useLocation() }),
    {
      wrapper: wrapperAt(state, hash),
    },
  );
}

describe("useSshKeySheet", () => {
  it("opens the sheet on arrival with the create SSH key hash", async () => {
    const { result } = renderSheet(vi.fn(), { return_to: "/" }, "#create-ssh-key");

    await waitFor(() => expect(result.current.sheet.open).toBe(true));
  });

  it("drops the hash after the open and keeps the return path", async () => {
    const { result } = renderSheet(vi.fn(), { return_to: "/" }, "#create-ssh-key");

    await waitFor(() => expect(result.current.location.hash).toBe(""));
    expect(result.current.sheet.open).toBe(true);
    expect(result.current.location.state).toEqual({ return_to: "/" });
    act(() => result.current.sheet.close());

    expect(result.current.sheet.open).toBe(false);
  });

  it("keeps the sheet closed on arrival with no hash", () => {
    const { result } = renderSheet(vi.fn(), null);

    expect(result.current.sheet.open).toBe(false);
  });

  it("opens the sheet on show", () => {
    const { result } = renderSheet(vi.fn(), null);

    act(() => result.current.sheet.show());

    expect(result.current.sheet.open).toBe(true);
  });

  it("returns to the path of the router state after the create", async () => {
    const reload = vi.fn();
    const { result } = renderSheet(reload, { return_to: "/" }, "#create-ssh-key");
    await waitFor(() => expect(result.current.location.hash).toBe(""));

    act(() => result.current.sheet.done());

    expect(await screen.findByText("Onboarding")).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });

  it("closes the sheet and reloads the list after the create with no return path", () => {
    const reload = vi.fn();
    const { result } = renderSheet(reload, null);
    act(() => result.current.sheet.show());

    act(() => result.current.sheet.done());

    expect(result.current.sheet.open).toBe(false);
    expect(result.current.location.pathname).toBe("/repositories");
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
