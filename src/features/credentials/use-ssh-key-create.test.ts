import { act, renderHook, waitFor } from "@testing-library/react";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import type { Credential } from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useSshKeyCreate } from "./use-ssh-key-create";

const KEY = {
  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA kanthord-deploy-atlas",
  fingerprint: "SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s",
};

const CREATED: Credential = {
  name: "deploy-atlas",
  platform: "ssh",
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
      revision: 1,
      metadata: KEY,
      created_at: 1,
      ended_at: null,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSshKeyCreate", () => {
  it("creates the key with the trimmed name and keeps the public key of the answer", async () => {
    vi.mocked(credentialsApi.createSshKey).mockResolvedValue(CREATED);
    const { result } = renderHook(() => useSshKeyCreate());

    act(() => result.current.setName(" deploy-atlas "));
    act(() => result.current.submit());

    expect(result.current.submitting).toBe(true);
    await waitFor(() => expect(result.current.created).toEqual({ name: "deploy-atlas", key: KEY }));
    expect(credentialsApi.createSshKey).toHaveBeenCalledWith({ name: "deploy-atlas" });
    expect(result.current.submitting).toBe(false);
  });

  it("refuses a reserved name before the call", () => {
    const { result } = renderHook(() => useSshKeyCreate());

    act(() => result.current.setName("ssh"));
    act(() => result.current.submit());

    expect(result.current.nameError).toBe("The name ssh is reserved. Choose another name.");
    expect(credentialsApi.createSshKey).not.toHaveBeenCalled();
  });

  it("maps a taken name to the custody message and keeps the form", async () => {
    vi.mocked(credentialsApi.createSshKey).mockRejectedValue(
      new ApiError("conflict", "Credential name already exists.", 409, "credential.name.conflict"),
    );
    const { result } = renderHook(() => useSshKeyCreate());

    act(() => result.current.setName("atlas-ssh"));
    act(() => result.current.submit());

    await waitFor(() =>
      expect(result.current.failure).toBe(
        "A credential with this name already exists. Choose another name.",
      ),
    );
    expect(result.current.created).toBeNull();
  });

  it("creates once while a create is in flight", () => {
    vi.mocked(credentialsApi.createSshKey).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useSshKeyCreate());

    act(() => result.current.setName("deploy-atlas"));
    act(() => result.current.submit());
    act(() => result.current.submit());

    expect(credentialsApi.createSshKey).toHaveBeenCalledTimes(1);
  });
});
