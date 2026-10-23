import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import {
  readBindingEnvironment,
  rebuildEnvironment,
  writeBindingEnvironment,
} from "@/api/resources/projects";
import type { BindingEnvironment, BindingSetWriteResult, EnvironmentState } from "@/api/types";
import { useBindingEnvironment } from "./use-binding-environment";

vi.mock("@/api/resources/projects", () => ({
  readBindingEnvironment: vi.fn(),
  rebuildEnvironment: vi.fn(),
  writeBindingEnvironment: vi.fn(),
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
  vi.mocked(writeBindingEnvironment).mockResolvedValue({} as BindingSetWriteResult);
});

const NOT_OBJECT =
  "The environment is not a JSON object. Remove the comments and the trailing commas.";

async function mounted(read: BindingEnvironment = ENVIRONMENT) {
  vi.mocked(readBindingEnvironment).mockResolvedValue(read);
  const onChanged = vi.fn();
  const onWritten = vi.fn();
  const hook = renderHook(() =>
    useBindingEnvironment("prj-1", "binding_1", "engine", onChanged, onWritten),
  );
  await waitFor(() => expect(hook.result.current.environment.data).toEqual(read));
  return { hook, onChanged, onWritten };
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
    expect(write).toHaveBeenCalledWith(JSON.stringify(ENVIRONMENT.environment, null, 2));
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

  describe("edit", () => {
    it("starts from the stored environment as indented JSON", async () => {
      const { hook } = await mounted();
      expect(hook.result.current.initialText).toBe(
        JSON.stringify(ENVIRONMENT.environment, null, 2),
      );
    });

    it("starts empty when the environment is not stored", async () => {
      const { hook } = await mounted({ ...ENVIRONMENT, source: "detected" });
      expect(hook.result.current.initialText).toBe("");
    });

    it.each(["[1, 2]", "null", "{"])("refuses %j without a request", async (text) => {
      const { hook } = await mounted();
      act(() => hook.result.current.openEdit());
      act(() => hook.result.current.save(text));
      expect(hook.result.current.saveError).toBe(NOT_OBJECT);
      expect(hook.result.current.editing).toBe(true);
      expect(writeBindingEnvironment).not.toHaveBeenCalled();
    });

    it("writes the document, reports it and closes the sheet", async () => {
      const { hook, onChanged, onWritten } = await mounted();
      act(() => hook.result.current.openEdit());
      act(() => hook.result.current.save('{ "image": "x" }'));
      await waitFor(() => expect(hook.result.current.editing).toBe(false));
      expect(writeBindingEnvironment).toHaveBeenCalledWith("prj-1", "binding_1", { image: "x" });
      expect(toast.success).toHaveBeenCalledWith("Saved the environment of engine.");
      expect(onWritten).toHaveBeenCalledWith({ image: "x" });
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(hook.result.current.saving).toBe(false);
    });

    it.each(["project.environment.key_refused", "project.environment.invalid"])(
      "shows the message of a %s refusal and keeps the sheet open",
      async (detail) => {
        vi.mocked(writeBindingEnvironment).mockRejectedValue(
          new ApiError("refused", "The server refuses it.", 400, detail),
        );
        const { hook, onWritten } = await mounted();
        act(() => hook.result.current.openEdit());
        act(() => hook.result.current.save("{}"));
        await waitFor(() => expect(hook.result.current.saveError).toBe("The server refuses it."));
        expect(hook.result.current.editing).toBe(true);
        expect(onWritten).not.toHaveBeenCalled();
      },
    );
  });
});
