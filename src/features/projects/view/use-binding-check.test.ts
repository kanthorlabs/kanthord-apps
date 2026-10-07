import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { checkBinding } from "@/api/resources/projects";
import type { BindingSetEntry, BindingVerifyResult } from "@/api/types";
import { useBindingCheck } from "./use-binding-check";

vi.mock("@/api/resources/projects", () => ({
  checkBinding: vi.fn(),
  listBindings: vi.fn(),
  verifyBinding: vi.fn(),
}));

vi.mock("@/features/credentials/credential-message", () => ({
  credentialMessage: (cause: ApiError) => cause.message,
}));

const checkMock = vi.mocked(checkBinding);

const HEALTHY_ADDRESS = { status: "healthy" as const, capability: "network git read" };
const HEALTHY_SSH = { status: "healthy" as const, capability: "ssh credential verify" };

const VERIFY_RESULT: BindingVerifyResult = {
  address: HEALTHY_ADDRESS,
  ssh_credential: HEALTHY_SSH,
  credential: null,
};

const REPO_ENTRY: BindingSetEntry = {
  kind: "repository",
  config: {
    available: true,
    platform: "github",
    address: "git@github.com:kanthorlabs/kanthord.git",
    strategy: { base_branch: "main" },
    ssh_credential: "github-ssh",
  },
};

const DRAFT = {
  platform: "github",
  address: "git@github.com:kanthorlabs/kanthord.git",
  sshCredential: "github-ssh",
  credential: "",
  actionName: "" as const,
};

function makeValidate(entry: BindingSetEntry | null): () => BindingSetEntry | null {
  return vi.fn(() => entry);
}

beforeEach(() => {
  checkMock.mockClear().mockResolvedValue(VERIFY_RESULT);
});

describe("useBindingCheck", () => {
  it("starts with no badges", () => {
    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, makeValidate(REPO_ENTRY)));
    expect(result.current.addressBadge).toBeNull();
    expect(result.current.sshCredentialBadge).toBeNull();
    expect(result.current.credentialBadge).toBeNull();
    expect(result.current.checking).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("shows checking badges while the request is pending then shows result badges", async () => {
    let resolve!: (v: BindingVerifyResult) => void;
    checkMock.mockReturnValue(new Promise<BindingVerifyResult>((r) => (resolve = r)));

    const validate = makeValidate(REPO_ENTRY);
    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, validate));

    act(() => result.current.run());
    expect(result.current.checking).toBe(true);
    expect(result.current.addressBadge?.label).toBe("Checking");
    expect(result.current.sshCredentialBadge?.label).toBe("Checking");

    await act(async () => resolve(VERIFY_RESULT));
    expect(result.current.checking).toBe(false);
    expect(result.current.addressBadge?.label).toBe("Healthy");
    expect(result.current.sshCredentialBadge?.label).toBe("Healthy");
    expect(result.current.credentialBadge).toBeNull();
    expect(checkMock).toHaveBeenCalledWith("prj-1", REPO_ENTRY);
  });

  it("shows a credential badge when the result includes one", async () => {
    const withCredential: BindingVerifyResult = {
      ...VERIFY_RESULT,
      credential: { status: "healthy", capability: "credential verify" },
    };
    checkMock.mockResolvedValue(withCredential);

    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, makeValidate(REPO_ENTRY)));
    await act(async () => result.current.run());
    expect(result.current.credentialBadge?.label).toBe("Healthy");
  });

  it("sends no request and calls validate when the draft is invalid", async () => {
    const validate = makeValidate(null);
    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, validate));
    act(() => result.current.run());
    expect(validate).toHaveBeenCalled();
    expect(checkMock).not.toHaveBeenCalled();
    expect(result.current.addressBadge).toBeNull();
  });

  it("maps a refusal to an error message", async () => {
    checkMock.mockRejectedValue(
      new ApiError(
        "conflict",
        "The address host does not match.",
        400,
        "project.bindings.repository.ssh_host_mismatch",
      ),
    );
    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, makeValidate(REPO_ENTRY)));
    await act(async () => result.current.run());
    expect(result.current.error).toBe("The address host does not match.");
    expect(result.current.addressBadge).toBeNull();
  });

  it("resets badges to none when a checked field changes", async () => {
    let currentDraft = { ...DRAFT };
    const { result, rerender } = renderHook(() =>
      useBindingCheck("prj-1", currentDraft, makeValidate(REPO_ENTRY)),
    );
    await act(async () => result.current.run());
    expect(result.current.addressBadge).not.toBeNull();

    currentDraft = { ...DRAFT, address: "git@github.com:kanthorlabs/apps.git" };
    rerender();
    expect(result.current.addressBadge).toBeNull();
    expect(result.current.sshCredentialBadge).toBeNull();
  });

  it("does not start a second request while checking", async () => {
    let resolve!: (v: BindingVerifyResult) => void;
    checkMock.mockReturnValue(new Promise<BindingVerifyResult>((r) => (resolve = r)));

    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, makeValidate(REPO_ENTRY)));
    act(() => result.current.run());
    act(() => result.current.run());
    await act(async () => resolve(VERIFY_RESULT));
    expect(checkMock).toHaveBeenCalledTimes(1);
  });
});
