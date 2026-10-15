import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/session/session-context", () => ({
  useSession: () => ({
    session: {
      instance: { id: "i-local", name: "local", baseUrl: "http://localhost:31415" },
      token: "jwt-1",
      identity: { kind: "human", sub: "kanthorlabs", name: "Ulrich" },
    },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/features/projects/project-context", () => {
  const project = { id: "prj-1", name: "kanthord" };
  return {
    ProjectProvider: ({ children }: { children: ReactNode }) => children,
    useProject: () => ({
      projects: [project],
      project,
      loading: false,
      error: null,
      reload: () => undefined,
    }),
  };
});

vi.mock("@/features/scheduler/board/scheduler-screen", () => ({
  SchedulerScreen: () => <p>Scheduler body</p>,
}));

import { AppRouter } from "./app-router";

describe("AppRouter", () => {
  it("serves the scheduler at its own route", () => {
    window.history.pushState({}, "", "/scheduler");

    render(<AppRouter />);

    expect(screen.getByText("Scheduler body")).toBeInTheDocument();
  });
});
