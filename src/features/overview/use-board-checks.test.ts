import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { verifyCredential } from "@/api/resources/credentials";
import { rebuildEnvironment } from "@/api/resources/projects";
import type { EnvironmentState, HealthEntry, Project } from "@/api/types";
import type { CredentialRefusedItem, EnvironmentFailedItem } from "@/lib/fix-attention";

vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/projects");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { useBoardChecks } from "./use-board-checks";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const CREDENTIAL: CredentialRefusedItem = {
  id: "credential_refused:openai-main",
  kind: "credential_refused",
  group: "fixes",
  project: PROJECT,
  subject: "openai-main",
  at: null,
  cause: "Credential refused",
  nodeIds: [],
  projects: [PROJECT],
  count: 1,
  projectCount: 1,
  credential: "openai-main",
  credentials: ["openai-main"],
  nodeName: "Team",
};

const ENVIRONMENT: EnvironmentFailedItem = {
  id: "environment_failed:prj-1:binding_1",
  kind: "environment_failed",
  group: "fixes",
  project: PROJECT,
  subject: "api",
  at: null,
  cause: "Environment failed",
  binding: "api",
  bindingId: "binding_1",
  failure: null,
  failureClass: "setup",
  nodeIds: [],
  projects: [PROJECT],
} as unknown as EnvironmentFailedItem;

const REFUSED: HealthEntry = {
  status: "unhealthy",
  capability: "llm",
  failure_reason: "unauthorized",
};

const reload = vi.fn();
const markActed = vi.fn();

function mount(item: CredentialRefusedItem | EnvironmentFailedItem) {
  return renderHook(() => useBoardChecks(item, { reload, markActed }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useBoardChecks verify", () => {
  it("shows Checking while the call runs, then a badge that stays", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let settle: (entry: HealthEntry) => void = () => undefined;
    vi.mocked(verifyCredential).mockReturnValue(
      new Promise<HealthEntry>((resolve) => {
        settle = resolve;
      }),
    );
    const { result } = mount(CREDENTIAL);

    act(() => result.current.verify.verify());
    expect(result.current.verify.label).toBe("Checking");
    expect(result.current.verify.checking).toBe(true);
    expect(verifyCredential).toHaveBeenCalledWith("llm", "openai-main");

    await act(async () => settle(REFUSED));
    expect(result.current.verify.label).toBe("Refused: unauthorized");
    expect(result.current.verify.checking).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.verify.label).toBe("Refused: unauthorized");
  });

  it("labels a healthy result", async () => {
    vi.mocked(verifyCredential).mockResolvedValue({
      status: "healthy",
      capability: "llm",
      failure_reason: null,
    });
    const { result } = mount(CREDENTIAL);

    act(() => result.current.verify.verify());

    await waitFor(() => expect(result.current.verify.label).toBe("Healthy"));
  });

  it("labels a failed call and offers Retry in the toast", async () => {
    vi.mocked(verifyCredential).mockRejectedValue(new ApiError("unavailable", "Down.", 503));
    const { result } = mount(CREDENTIAL);

    act(() => result.current.verify.verify());

    await waitFor(() => expect(result.current.verify.label).toBe("Check failed"));
    expect(toast.error).toHaveBeenCalledWith(
      "Verifying openai-main failed.",
      expect.objectContaining({ description: "Down." }),
    );
  });
});

describe("useBoardChecks onboarding", () => {
  it("rebuilds with the project id and the binding id and toasts the start", async () => {
    vi.mocked(rebuildEnvironment).mockResolvedValue({} as EnvironmentState);
    const { result } = mount(ENVIRONMENT);

    act(() => result.current.onboarding.run());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Onboarding of api started."));
    expect(rebuildEnvironment).toHaveBeenCalledWith("prj-1", "binding_1");
    expect(markActed).toHaveBeenCalledWith("environment_failed:prj-1:binding_1");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.onboarding.failure).toBeNull();
  });

  it("toasts info on an active run and sets no failure line", async () => {
    vi.mocked(rebuildEnvironment).mockRejectedValue(
      new ApiError("conflict", "Active.", 409, "project.environment.run_active"),
    );
    const { result } = mount(ENVIRONMENT);

    act(() => result.current.onboarding.run());

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith("An onboarding run of api is active."),
    );
    expect(result.current.onboarding.failure).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("exposes the failure line of another failure and sends again on Retry", async () => {
    vi.mocked(rebuildEnvironment)
      .mockRejectedValueOnce(new ApiError("unavailable", "Down.", 503))
      .mockResolvedValue({} as EnvironmentState);
    const { result } = mount(ENVIRONMENT);

    act(() => result.current.onboarding.run());
    await waitFor(() =>
      expect(result.current.onboarding.failure?.text).toBe(
        "Starting the onboarding of api failed. Down.",
      ),
    );
    expect(toast.error).toHaveBeenCalledWith("Starting the onboarding of api failed.", {
      description: "Down.",
    });
    expect(markActed).not.toHaveBeenCalled();

    act(() => result.current.onboarding.failure?.retry());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Onboarding of api started."));
    expect(rebuildEnvironment).toHaveBeenCalledTimes(2);
  });
});
