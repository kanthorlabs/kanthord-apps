import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setConnection } from "@/api/client";
import { SessionProvider } from "@/features/auth/session/session-context";
import { AppShell } from "./app-shell";

vi.mock("@/api/resources/gateway", () => ({
  readLiveness: vi.fn(),
  verifyHumanToken: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  setConnection: vi.fn(),
}));

vi.mock("@/features/projects/project-context", () => ({
  useProject: () => ({ projects: [], project: null, select: () => undefined }),
}));

const STORED = {
  instance: { id: "i-local", name: "local", baseUrl: "http://localhost:31415" },
  token: "jwt-1",
  identity: { kind: "human", sub: "kanthorlabs", name: "Ulrich" },
};

function mount() {
  return render(
    <SessionProvider>
      <MemoryRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<p>Overview body</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.setItem("kanthord.session", JSON.stringify(STORED));
  });

  it("names the signed-in human and the instance in the sidebar footer", () => {
    mount();

    expect(screen.getByText("Ulrich")).toBeTruthy();
    expect(screen.getByText("local")).toBeTruthy();
  });

  it("signs out from the sidebar footer", async () => {
    mount();

    const [footerSignOut] = screen.getAllByRole("button", { name: "Sign out" });
    if (footerSignOut === undefined) throw new Error("no sign out control");
    await userEvent.click(footerSignOut);

    expect(window.sessionStorage.getItem("kanthord.session")).toBeNull();
    expect(setConnection).toHaveBeenLastCalledWith(null);
  });
});
