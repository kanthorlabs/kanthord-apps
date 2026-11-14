import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import {
  listAllCredentials,
  listCredentialPlatforms,
  rotateCredential,
} from "@/api/resources/credentials";
import type { Credential } from "@/api/types";
import { EMPTY_SECRET } from "@/lib/credential-draft";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useNamedRotate } from "./use-board-rotate";

const NAME = "openai-main";
const reload = vi.fn();
const onActed = vi.fn();
const onOpenChange = vi.fn();
const options = { reload, onActed, onOpenChange };

function copyOf(holder: string, revision: number, name = NAME): Credential {
  return {
    name,
    platform: "openai",
    holder,
    sealed_to: null,
    sealed_current: true,
    revisions: [
      { id: "old", revision: revision - 1, metadata: null, created_at: 1, ended_at: 2 },
      { id: "live", revision, metadata: null, created_at: 2, ended_at: null },
    ],
  };
}

async function readyHook() {
  const hook = renderHook(() => useNamedRotate(NAME, options));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listAllCredentials).mockResolvedValue([copyOf("server", 5), copyOf("mac-studio", 3)]);
  vi.mocked(listCredentialPlatforms).mockResolvedValue({
    items: [
      {
        platform: "openai",
        secret_shape: "api_key",
        login_modes: [],
        metadata_fields: [],
        verifiable: false,
      },
    ],
  });
});

describe("useNamedRotate", () => {
  it("loads until both reads answer, then holds the newest live server revision", async () => {
    const { result } = renderHook(() => useNamedRotate(NAME, options));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.revision).toBe(5);
    expect(result.current.missing).toBeNull();
  });

  it("reports the rotated copies once, then reloads, after a full success", async () => {
    vi.mocked(rotateCredential).mockResolvedValue(copyOf("server", 6));
    const { result } = await readyHook();

    act(() => result.current.start());
    act(() => result.current.setSecret({ ...EMPTY_SECRET, key: "sk-2" }));
    act(() => result.current.submit());

    await waitFor(() => expect(onActed).toHaveBeenCalledTimes(1));
    expect(onActed).toHaveBeenCalledWith({ revision: 6, holders: [], server: true });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reports server false and the passed holder after a rejected server rotation", async () => {
    vi.mocked(rotateCredential).mockImplementation((_component, _name, _body, holder) =>
      holder === "server"
        ? Promise.reject(new ApiError("unavailable", "The server is down.", 503))
        : Promise.resolve(copyOf("mac-studio", 4)),
    );
    const { result } = await readyHook();

    act(() => result.current.start());
    act(() => result.current.setSecret({ ...EMPTY_SECRET, key: "sk-2" }));
    act(() => result.current.choose(["mac-studio (v3)"]));
    act(() => result.current.submit());

    await waitFor(() => expect(result.current.outcome).toHaveLength(1));
    expect(result.current.outcome[0]).toContain("server: not rotated.");
    expect(onActed).not.toHaveBeenCalled();

    act(() => result.current.close());

    expect(onActed).toHaveBeenCalledTimes(1);
    expect(onActed).toHaveBeenCalledWith({ revision: 4, holders: ["mac-studio"], server: false });
  });

  it("tells the owner of the open state on start and close", async () => {
    const { result } = await readyHook();

    act(() => result.current.start());
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(true));

    act(() => result.current.close());

    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
  });

  it("reports nothing after a revision conflict and readLatest", async () => {
    vi.mocked(rotateCredential).mockRejectedValue(
      new ApiError("conflict", "Conflict.", 409, "credential.revision.conflict"),
    );
    const { result } = await readyHook();

    act(() => result.current.start());
    act(() => result.current.setSecret({ ...EMPTY_SECRET, key: "sk-2" }));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.failure).not.toBeNull());

    act(() => result.current.readLatest());

    await waitFor(() => expect(listAllCredentials).toHaveBeenCalledTimes(2));
    expect(onActed).not.toHaveBeenCalled();
  });

  it("holds no revision and names the missing server copy", async () => {
    vi.mocked(listAllCredentials).mockResolvedValue([copyOf("mac-studio", 3)]);
    const { result } = await readyHook();

    expect(result.current.revision).toBeNull();
    expect(result.current.missing).toBe("a server copy of openai-main");
  });
});
