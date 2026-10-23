import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readBindingEnvironment, rebuildEnvironment } from "@/api/resources/projects";
import type { BindingEnvironment, EnvironmentState } from "@/api/types";
import { useBindingEnvironment } from "./use-binding-environment";

vi.mock("@/api/resources/projects", () => ({
  readBindingEnvironment: vi.fn(),
  rebuildEnvironment: vi.fn(),
}));
vi.mock("@/hooks/use-clipboard", () => ({ useClipboard: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { useClipboard } from "@/hooks/use-clipboard";

const ENVIRONMENT: BindingEnvironment = {
  source: "stored",
  commit: null,
  environment: { image: "node:24" },
  reason: null,
};

const write = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  write.mockResolvedValue(undefined);
  vi.mocked(useClipboard).mockReturnValue(write);
  vi.mocked(readBindingEnvironment).mockResolvedValue(ENVIRONMENT);
  vi.mocked(rebuildEnvironment).mockResolvedValue({} as EnvironmentState);
});

async function mounted(onChanged = vi.fn()) {
  const hook = renderHook(() => useBindingEnvironment("prj-1", "binding_1", "engine", onChanged));
  await waitFor(() => expect(hook.result.current.environment.data).toEqual(ENVIRONMENT));
  return { hook, onChanged };
}

describe("useBindingEnvironment", () => {
  it("reads the environment of the binding once", async () => {
    await mounted();
    expect(readBindingEnvironment).toHaveBeenCalledTimes(1);
    expect(readBindingEnvironment).toHaveBeenCalledWith("prj-1", "binding_1");
  });

  it("rebuilds, shows a toast and reports the change", async () => {
    const { hook, onChanged } = await mounted();
    act(() => hook.result.current.rebuild());
    expect(hook.result.current.rebuilding).toBe(true);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(rebuildEnvironment).toHaveBeenCalledWith("prj-1", "binding_1");
    expect(toast.success).toHaveBeenCalledWith("Onboarding of engine started.");
    expect(hook.result.current.rebuilding).toBe(false);
  });

  it("answers an active run with an info toast", async () => {
    vi.mocked(rebuildEnvironment).mockRejectedValue(
      new ApiError("conflict", "conflict", 409, "project.environment.run_active"),
    );
    const { hook, onChanged } = await mounted();
    act(() => hook.result.current.rebuild());
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(toast.info).toHaveBeenCalledWith("An onboarding run of engine is active.");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows another failure with a Retry action", async () => {
    vi.mocked(rebuildEnvironment).mockRejectedValueOnce(
      new ApiError("unavailable", "The daemon is down.", 503, "other"),
    );
    const { hook } = await mounted();
    act(() => hook.result.current.rebuild());
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const options = vi.mocked(toast.error).mock.calls[0]?.[1];
    expect(vi.mocked(toast.error).mock.calls[0]?.[0]).toBe("The daemon is down.");
    const action = options?.action as unknown as { label: string; onClick: () => void };
    expect(action.label).toBe("Retry");
    act(() => action.onClick());
    await waitFor(() => expect(rebuildEnvironment).toHaveBeenCalledTimes(2));
  });

  it("copies the environment as indented JSON", async () => {
    const { hook } = await mounted();
    act(() => hook.result.current.copy());
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Copied the environment of engine."),
    );
    expect(write).toHaveBeenCalledWith(JSON.stringify(ENVIRONMENT, null, 2));
  });

  it("copies a text and names it", async () => {
    const { hook } = await mounted();
    act(() => hook.result.current.copyText("pnpm test", "reproduce command"));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Copied the reproduce command."),
    );
    expect(write).toHaveBeenCalledWith("pnpm test");
  });

  it("reports a refused clipboard", async () => {
    write.mockRejectedValue(new Error("refused"));
    const { hook } = await mounted();
    act(() => hook.result.current.copyText("tail", "tail"));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The browser refused the clipboard."),
    );
  });
});
