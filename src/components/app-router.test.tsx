import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const owner = vi.hoisted(() => ({
  signedIn: true,
  session: {
    instance: { id: "i-local", name: "local", baseUrl: "http://localhost:31415" },
    token: "jwt-1",
    identity: { kind: "human", sub: "kanthorlabs", name: "Ulrich" },
  },
}));

vi.mock("@/features/auth/session/session-context", () => ({
  useSession: () => ({
    session: owner.signedIn ? owner.session : null,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/features/auth/login/login-screen", () => ({
  LoginScreen: () => <p>Login body</p>,
}));

vi.mock("@/features/guest/join-screen", () => ({
  JoinScreen: () => {
    const { pathname } = useLocation();
    return <p>{`Join body ${pathname}`}</p>;
  },
}));

vi.mock("@/features/guest/guest-screen", () => ({
  GuestScreen: () => <p>Guest body</p>,
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

vi.mock("@/features/workers/agent/agent-screen", () => ({
  AgentScreen: () => {
    const { pathname } = useLocation();
    return <p>{`Agent page ${pathname}`}</p>;
  },
}));

vi.mock("@/features/workers/variant/variant-screen", () => ({
  VariantScreen: () => {
    const { pathname } = useLocation();
    return <p>{`Variant page ${pathname}`}</p>;
  },
}));

vi.mock("@/features/footprint/list/footprint-screen", () => ({
  FootprintScreen: () => <p>Footprint body</p>,
}));

vi.mock("@/features/footprint/view/footprint-kind-screen", () => ({
  FootprintKindScreen: () => <p>Footprint kind body</p>,
}));

vi.mock("@/features/footprint/view/footprint-cleanup-screen", () => ({
  FootprintCleanupScreen: () => <p>Footprint cleanup body</p>,
}));

import { AppRouter } from "./app-router";

const INVITE = "5b0f8f0e-3a54-4a0b-9d5e-2f3f6a1c7a10";

describe("AppRouter", () => {
  afterEach(() => {
    owner.signedIn = true;
  });

  it("serves the scheduler at its own route", () => {
    window.history.pushState({}, "", "/scheduler");

    render(<AppRouter />);

    expect(screen.getByText("Scheduler body")).toBeInTheDocument();
    expect(screen.getByText("kanthord")).toBeInTheDocument();
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

  it("serves the variant page under its agent", () => {
    window.history.pushState({}, "", "/agents/swe%401/variants/agent_variant_1");

    render(<AppRouter />);

    expect(
      screen.getByText("Variant page /agents/swe%401/variants/agent_variant_1"),
    ).toBeInTheDocument();
  });

  it("redirects the variants path to the agent page", () => {
    window.history.pushState({}, "", "/agents/swe%401/variants");

    render(<AppRouter />);

    expect(screen.getByText("Agent page /agents/swe@1")).toBeInTheDocument();
  });

  it("serves the analytics page at its own route", () => {
    window.history.pushState({}, "", "/analytics");

    render(<AppRouter />);

    expect(screen.getByText("Analytics body")).toBeInTheDocument();
  });

  it("serves the cleanup record before the kind screen under footprint", () => {
    window.history.pushState({}, "", "/footprint/cleanups/cleanup_1");
    render(<AppRouter />);
    expect(screen.getByText("Footprint cleanup body")).toBeInTheDocument();
  });

  it("serves the kind screen under footprint", () => {
    window.history.pushState({}, "", "/footprint/workspace");
    render(<AppRouter />);
    expect(screen.getByText("Footprint kind body")).toBeInTheDocument();
  });

  it("serves the join screen with no owner session", () => {
    owner.signedIn = false;
    window.history.pushState({}, "", `/join/${INVITE}`);

    render(<AppRouter />);

    expect(screen.getByText(`Join body /join/${INVITE}`)).toBeInTheDocument();
    expect(screen.queryByText("Login body")).not.toBeInTheDocument();
  });

  it("serves the guest screen with no owner session", () => {
    owner.signedIn = false;
    window.history.pushState({}, "", "/guest");

    render(<AppRouter />);

    expect(screen.getByText("Guest body")).toBeInTheDocument();
    expect(screen.queryByText("Login body")).not.toBeInTheDocument();
  });

  it("serves the login screen at another route with no owner session", () => {
    owner.signedIn = false;
    window.history.pushState({}, "", "/scheduler");

    render(<AppRouter />);

    expect(screen.getByText("Login body")).toBeInTheDocument();
    expect(screen.queryByText("Scheduler body")).not.toBeInTheDocument();
  });

  it("serves the join screen outside the shell with an owner session", () => {
    window.history.pushState({}, "", `/join/${INVITE}`);

    render(<AppRouter />);

    expect(screen.getByText(`Join body /join/${INVITE}`)).toBeInTheDocument();
    expect(screen.queryByText("kanthord")).not.toBeInTheDocument();
  });

  it("serves the guest screen outside the shell with an owner session", () => {
    window.history.pushState({}, "", "/guest");

    render(<AppRouter />);

    expect(screen.getByText("Guest body")).toBeInTheDocument();
    expect(screen.queryByText("kanthord")).not.toBeInTheDocument();
  });
});
