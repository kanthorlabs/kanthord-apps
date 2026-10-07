import { render, screen, within } from "@testing-library/react";
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

const PROJECT = { id: "prj-1", name: "kanthord", binding_set_version: 1, created_at: 1 };

const projectState = vi.hoisted(() => ({
  value: {
    projects: [] as unknown[],
    project: null as unknown,
    loading: false,
    error: null as string | null,
    reload: () => undefined,
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

function mount(path = "/") {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<p>Overview body</p>} />
            <Route path="projects/new" element={<p>New project body</p>} />
            <Route path="scheduler" element={<p>Scheduler body</p>} />
            <Route path="llm" element={<p>LLM body</p>} />
            <Route path="agents/:agentName" element={<p>Agent body</p>} />
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
      loading: false,
      error: null,
      reload: () => undefined,
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
    expect(screen.getByRole("button", { name: "New project" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
  });

  it("serves the project pages to an instance that holds no project", () => {
    projectState.value = { ...projectState.value, projects: [], project: null };
    mount("/projects/new");

    expect(screen.getByText("New project body")).toBeTruthy();
  });

  it("serves the server-wide screens to an instance that holds no project", () => {
    projectState.value = { ...projectState.value, projects: [], project: null };
    mount("/llm");

    expect(screen.getByText("LLM body")).toBeTruthy();
  });

  it("serves an agent page to an instance that holds no project", () => {
    projectState.value = { ...projectState.value, projects: [], project: null };
    mount("/agents/re@1");

    expect(screen.getByText("Agent body")).toBeTruthy();
  });

  it("holds a project-scoped screen until the instance holds a project", () => {
    projectState.value = { ...projectState.value, projects: [], project: null };
    mount("/scheduler");

    expect(screen.queryByText("Scheduler body")).toBeNull();
    expect(screen.getByText("No projects")).toBeTruthy();
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

  it("names the signed-in human and the instance in the topbar", () => {
    mount();

    const topbar = screen.getByRole("banner");
    expect(within(topbar).getByText("Ulrich")).toBeTruthy();
    expect(within(topbar).getByText("local")).toBeTruthy();
  });

  it("names the credential sections under the Credentials group", () => {
    mount();

    expect(screen.getByText("Credentials")).toBeTruthy();
    expect(screen.getByRole("link", { name: "LLM" })).toHaveAttribute("href", "/llm");
  });

  it("signs out from the sidebar footer", async () => {
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(window.sessionStorage.getItem("kanthord.session")).toBeNull();
    expect(setConnection).toHaveBeenLastCalledWith(null);
  });
});
