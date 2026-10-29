import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
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

vi.mock("@/features/timeline/timeline-screen", () => ({
  TimelineScreen: () => <p>Timeline body</p>,
}));

vi.mock("@/features/analytics/analytics-screen", () => ({
  AnalyticsScreen: () => <p>Analytics body</p>,
}));

vi.mock("@/features/workers/worker/worker-screen", () => ({
  WorkerScreen: () => {
    const { pathname, search } = useLocation();
    return <p>{`Worker page ${pathname}${search}`}</p>;
  },
}));

import { AppRouter } from "./app-router";

describe("AppRouter", () => {
  it("serves the scheduler at its own route", () => {
    window.history.pushState({}, "", "/scheduler");

    render(<AppRouter />);

    expect(screen.getByText("Scheduler body")).toBeInTheDocument();
  });

  it("serves the timeline at its own route", () => {
    window.history.pushState({}, "", "/timeline?node_id=node_1");

    render(<AppRouter />);

    expect(screen.getByText("Timeline body")).toBeInTheDocument();
  });

  it("redirects the instances path to the worker page and keeps the project", () => {
    window.history.pushState({}, "", "/workers/coder%401/instances?project=prj-b");

    render(<AppRouter />);

    expect(screen.getByText("Worker page /workers/coder@1?project=prj-b")).toBeInTheDocument();
  });

  it("serves the analytics page at its own route", () => {
    window.history.pushState({}, "", "/analytics");

    render(<AppRouter />);

    expect(screen.getByText("Analytics body")).toBeInTheDocument();
  });
});
