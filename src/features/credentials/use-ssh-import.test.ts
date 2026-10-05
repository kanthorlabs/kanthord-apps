import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { createCredential, discoverSshAliases } from "@/api/resources/credentials";
import type { SshDiscoverResult } from "@/api/types";
import { useSshImport } from "./use-ssh-import";

vi.mock("@/api/resources/credentials", () => ({
  discoverSshAliases: vi.fn(),
  createCredential: vi.fn(),
}));

vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const discoverMock = vi.mocked(discoverSshAliases);
const createMock = vi.mocked(createCredential);
const toastSuccessMock = vi.mocked(toast.success);

const DISCOVER_RESULT: SshDiscoverResult = {
  items: [
    {
      host: "github.com",
      hostname: "github.com",
      port: 22,
      state: "ready",
      identity_file: "~/.ssh/id_ed25519",
    },
    {
      host: "gitlab.com",
      hostname: "gitlab.com",
      port: 22,
      state: "refused",
      identity_file: null,
      reason: "Multiple identity files",
    },
    {
      host: "bitbucket.org",
      hostname: "bitbucket.org",
      port: 22,
      state: "present",
      identity_file: null,
    },
  ],
};

beforeEach(() => {
  discoverMock.mockClear().mockResolvedValue(DISCOVER_RESULT);
  createMock.mockClear().mockResolvedValue({} as never);
  toastSuccessMock.mockClear();
});

describe("useSshImport", () => {
  it("discovers aliases on mount and exposes items", async () => {
    const { result } = renderHook(() => useSshImport(() => {}));
    expect(result.current.loading).toBe(true);
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toHaveLength(3);
    expect(result.current.discoverError).toBeNull();
  });

  it("exposes a discover error when the request fails", async () => {
    discoverMock.mockRejectedValue(new ApiError("unavailable", "SSH config unreadable.", 503));
    const { result } = renderHook(() => useSshImport(() => {}));
    await act(async () => {});
    expect(result.current.discoverError?.message).toBe("SSH config unreadable.");
    expect(result.current.items).toHaveLength(0);
  });

  it("toggle adds and removes a host from the selection", async () => {
    const { result } = renderHook(() => useSshImport(() => {}));
    await act(async () => {});
    act(() => result.current.toggle("github.com", true));
    expect(result.current.selected.has("github.com")).toBe(true);
    act(() => result.current.toggle("github.com", false));
    expect(result.current.selected.has("github.com")).toBe(false);
  });

  it("readyCount counts only selected ready items", async () => {
    const { result } = renderHook(() => useSshImport(() => {}));
    await act(async () => {});
    act(() => {
      result.current.toggle("github.com", true);
      result.current.toggle("bitbucket.org", true);
    });
    expect(result.current.readyCount).toBe(1);
  });

  it("creates credentials sequentially with derived names and calls onImported", async () => {
    const onImported = vi.fn();
    const { result } = renderHook(() => useSshImport(onImported));
    await act(async () => {});
    act(() => result.current.toggle("github.com", true));
    await act(async () => result.current.submit());
    expect(createMock).toHaveBeenCalledOnce();
    expect(createMock).toHaveBeenCalledWith("repository", {
      name: "github-com",
      platform: "ssh",
      metadata: {
        host: "github.com",
        hostname: "github.com",
        port: 22,
        identity_file: "~/.ssh/id_ed25519",
      },
      secret: {},
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Created github-com.");
    expect(onImported).toHaveBeenCalledWith(["github-com"]);
  });

  it("records a per-row failure and does not call onImported when all rows fail", async () => {
    createMock.mockRejectedValue(
      new ApiError("conflict", "Name taken.", 409, "credential.name.conflict"),
    );
    const onImported = vi.fn();
    const { result } = renderHook(() => useSshImport(onImported));
    await act(async () => {});
    act(() => result.current.toggle("github.com", true));
    await act(async () => result.current.submit());
    expect(result.current.failures).toHaveLength(1);
    expect(result.current.failures[0]?.host).toBe("github.com");
    expect(result.current.failures[0]?.message).toMatch(/already exists/);
    expect(onImported).not.toHaveBeenCalled();
  });

  it("calls onImported with successful names even when some rows fail", async () => {
    const secondItem: SshDiscoverResult = {
      items: [
        {
          host: "github.com",
          hostname: "github.com",
          port: 22,
          state: "ready",
          identity_file: "~/.ssh/id_ed25519",
        },
        {
          host: "work.github.com",
          hostname: "github.com",
          port: 22,
          state: "ready",
          identity_file: "~/.ssh/id_work",
        },
      ],
    };
    discoverMock.mockResolvedValue(secondItem);
    createMock
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(
        new ApiError("conflict", "Name taken.", 409, "credential.name.conflict"),
      );
    const onImported = vi.fn();
    const { result } = renderHook(() => useSshImport(onImported));
    await act(async () => {});
    act(() => {
      result.current.toggle("github.com", true);
      result.current.toggle("work.github.com", true);
    });
    await act(async () => result.current.submit());
    expect(result.current.failures).toHaveLength(1);
    expect(onImported).toHaveBeenCalledWith(["github-com"]);
  });

  it("does not pass refused or present items to create even when selected", async () => {
    const onImported = vi.fn();
    const { result } = renderHook(() => useSshImport(onImported));
    await act(async () => {});
    act(() => {
      result.current.toggle("gitlab.com", true);
      result.current.toggle("bitbucket.org", true);
    });
    await act(async () => result.current.submit());
    expect(createMock).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();
  });

  it("refetches discovery on reload", async () => {
    const { result } = renderHook(() => useSshImport(() => {}));
    await act(async () => {});
    expect(discoverMock).toHaveBeenCalledTimes(1);
    act(() => result.current.reload());
    await act(async () => {});
    expect(discoverMock).toHaveBeenCalledTimes(2);
  });
});
