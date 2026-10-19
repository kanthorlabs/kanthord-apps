import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { checkBinding } from "@/api/resources/projects";
import type { BindingSetEntry, BindingVerifyResult } from "@/api/types";
import { failureReasonHint } from "@/lib/failure-reason";
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

const HEALTHY_ADDRESS = {
  status: "healthy" as const,
  capability: "network git read",
  failure_reason: null,
};
const HEALTHY_SSH = {
  status: "healthy" as const,
  capability: "ssh credential verify",
  failure_reason: null,
};

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
      credential: { status: "healthy", capability: "credential verify", failure_reason: null },
    };
    checkMock.mockResolvedValue(withCredential);

    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, makeValidate(REPO_ENTRY)));
    await act(async () => result.current.run());
    expect(result.current.credentialBadge?.label).toBe("Healthy");
  });

  it("gives the hint of the failure reason of an unhealthy address", async () => {
    checkMock.mockResolvedValue({
      ...VERIFY_RESULT,
      address: {
        status: "unhealthy",
        capability: "network git read",
        failure_reason: "host_key_unknown",
      },
    });

    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, makeValidate(REPO_ENTRY)));
    await act(async () => result.current.run());
    expect(result.current.addressBadge?.label).toBe("Unhealthy");
    expect(result.current.addressHint).toBe(failureReasonHint("host_key_unknown", "repository"));
  });

  it("gives the hint of the failure reason of an unhealthy SSH credential", async () => {
    checkMock.mockResolvedValue({
      ...VERIFY_RESULT,
      ssh_credential: {
        status: "unhealthy",
        capability: "ssh identity",
        failure_reason: "identity_unavailable",
      },
    });

    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, makeValidate(REPO_ENTRY)));
    await act(async () => result.current.run());
    expect(result.current.sshCredentialBadge?.label).toBe("Unhealthy");
    expect(result.current.sshCredentialHint).toBe(
      failureReasonHint("identity_unavailable", "repository"),
    );
    expect(result.current.keyRefused).toBe(false);
  });

  it("marks a key that the repository host refuses", async () => {
    checkMock.mockResolvedValue({
      ...VERIFY_RESULT,
      address: {
        status: "unhealthy",
        capability: "network git read",
        failure_reason: "key_refused",
      },
    });

    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, makeValidate(REPO_ENTRY)));
    expect(result.current.keyRefused).toBe(false);
    await act(async () => result.current.run());
    expect(result.current.keyRefused).toBe(true);
    expect(result.current.sshCredentialHint).toBeNull();
  });

  it("gives no hint for a healthy address", async () => {
    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, makeValidate(REPO_ENTRY)));
    expect(result.current.addressHint).toBeNull();
    await act(async () => result.current.run());
    expect(result.current.addressHint).toBeNull();
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
        "refused",
        "Repository address must have the form git@<host>:<owner>/<repository>.git.",
        400,
        "project.bindings.repository.address_invalid",
      ),
    );
    const { result } = renderHook(() => useBindingCheck("prj-1", DRAFT, makeValidate(REPO_ENTRY)));
    await act(async () => result.current.run());
    expect(result.current.error).toBe(
      "Repository address must have the form git@<host>:<owner>/<repository>.git.",
    );
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
