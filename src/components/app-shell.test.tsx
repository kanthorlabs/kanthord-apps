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

const PROJECT = { id: "prj-1", name: "kanthord", bindingSetVersion: 1, createdAt: 1 };

const projectState = vi.hoisted(() => ({
  value: {
    projects: [] as unknown[],
    project: null as unknown,
    select: () => undefined,
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("@/features/projects/project-context", () => ({
  useProject: () => projectState.value,
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
    projectState.value = {
      projects: [PROJECT],
      project: PROJECT,
      select: () => undefined,
      loading: false,
      error: null,
    };
  });

  it("renders the screen when a project is selected", () => {
    mount();

    expect(screen.getByText("Overview body")).toBeTruthy();
  });

  it("explains an instance that holds no project", () => {
    projectState.value = { ...projectState.value, projects: [], project: null };
    mount();

    expect(screen.queryByText("Overview body")).toBeNull();
    expect(screen.getByText("No projects")).toBeTruthy();
    expect(screen.getByText("kanthord project create")).toBeTruthy();
  });

  it("reports a project list that failed", () => {
    projectState.value = {
      ...projectState.value,
      projects: [],
      project: null,
      error: "The daemon did not answer.",
    };
    mount();

    expect(screen.queryByText("Overview body")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("The daemon did not answer.");
  });

  it("names the signed-in human and the instance in the sidebar footer", () => {
    mount();

    expect(screen.getByText("Ulrich")).toBeTruthy();
    expect(screen.getByText("local")).toBeTruthy();
  });

  it("signs out from the sidebar footer", async () => {
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(window.sessionStorage.getItem("kanthord.session")).toBeNull();
    expect(setConnection).toHaveBeenLastCalledWith(null);
  });
});
