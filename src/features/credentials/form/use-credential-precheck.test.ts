import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as credentialsApi from "@/api/resources/credentials";
import type { CredentialComponent, CredentialPlatformEntry } from "@/api/types";
import { EMPTY_METADATA, EMPTY_SECRET } from "@/lib/credential-draft";
import { failureReasonHint } from "@/lib/failure-reason";

vi.mock("@/api/resources/credentials");

import { useCredentialPrecheck } from "./use-credential-precheck";

const OPENROUTER: CredentialPlatformEntry = {
  platform: "openrouter",
  secret_shape: "api_key",
  login_modes: [],
  metadata_fields: [],
  verifiable: true,
};

const GITHUB: CredentialPlatformEntry = { ...OPENROUTER, platform: "github" };

const SECRET = { ...EMPTY_SECRET, key: "sk-fake" };

function mount(component: CredentialComponent = "llm", entry = OPENROUTER) {
  return renderHook(() =>
    useCredentialPrecheck(component, entry, SECRET, EMPTY_METADATA, vi.fn(), vi.fn()),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCredentialPrecheck", () => {
  it("gives the hint of the failure reason of an unhealthy check", async () => {
    vi.mocked(credentialsApi.checkCredential).mockResolvedValue({
      status: "unhealthy",
      capability: "model-list read",
      failure_reason: "unauthorized",
    });
    const { result } = mount();

    expect(result.current.hint).toBeNull();
    act(() => result.current.run());

    await waitFor(() => expect(result.current.badge?.label).toBe("Unhealthy"));
    expect(result.current.hint).toBe(failureReasonHint("unauthorized", "llm"));
  });

  it("gives the hint in the words of the repository component", async () => {
    vi.mocked(credentialsApi.checkCredential).mockResolvedValue({
      status: "unhealthy",
      capability: "rate-limit read",
      failure_reason: "unauthorized",
    });
    const { result } = mount("repository", GITHUB);

    act(() => result.current.run());

    await waitFor(() => expect(result.current.badge?.label).toBe("Unhealthy"));
    expect(result.current.hint).toBe(failureReasonHint("unauthorized", "repository"));
    expect(result.current.hint).not.toBe(failureReasonHint("unauthorized", "llm"));
  });

  it("gives no hint for a healthy check", async () => {
    vi.mocked(credentialsApi.checkCredential).mockResolvedValue({
      status: "healthy",
      capability: "model-list read",
      failure_reason: null,
    });
    const { result } = mount();

    act(() => result.current.run());

    await waitFor(() => expect(result.current.badge?.label).toBe("Healthy"));
    expect(result.current.hint).toBeNull();
  });
});
