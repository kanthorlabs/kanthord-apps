import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import {
  listCredentialPlatforms,
  readCredential,
  verifyCredential,
} from "@/api/resources/credentials";
import type { CredentialPlatformEntry, LlmCredential } from "@/api/types";
import { useCredentialVerifyAction } from "./use-credential-verify-action";

vi.mock("@/api/resources/credentials", () => ({
  readCredential: vi.fn(),
  listCredentialPlatforms: vi.fn(),
  verifyCredential: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const ROUTER: LlmCredential = {
  name: "router-main",
  platform: "openrouter",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [{ revision: 1, created_at: 1, ended_at: null } as LlmCredential["revisions"][number]],
  agent_providers: [],
};

const platform = (verifiable: boolean): CredentialPlatformEntry => ({
  platform: "openrouter",
  secret_shape: "api_key",
  login_modes: [],
  metadata_fields: [],
  verifiable,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readCredential).mockResolvedValue(ROUTER);
  vi.mocked(listCredentialPlatforms).mockResolvedValue({ items: [platform(true)] });
  vi.mocked(verifyCredential).mockResolvedValue({
    status: "healthy",
    capability: "key read",
    failure_reason: null,
  });
});

describe("useCredentialVerifyAction", () => {
  it("verifies a live credential of a verifiable platform", async () => {
    const { result } = renderHook(() => useCredentialVerifyAction("llm", "router-main"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.blocked).toBeNull();
    act(() => result.current.check.verify());
    await waitFor(() => expect(verifyCredential).toHaveBeenCalledWith("llm", "router-main"));
  });

  it("blocks a platform that the server cannot verify", async () => {
    vi.mocked(listCredentialPlatforms).mockResolvedValue({ items: [platform(false)] });
    const { result } = renderHook(() => useCredentialVerifyAction("llm", "router-main"));
    await waitFor(() =>
      expect(result.current.blocked).toBe("Verification is not supported yet for openrouter."),
    );
  });

  it("blocks an archived credential", async () => {
    vi.mocked(readCredential).mockResolvedValue({
      ...ROUTER,
      revisions: [{ ...ROUTER.revisions[0]!, ended_at: 5 }],
    });
    const { result } = renderHook(() => useCredentialVerifyAction("llm", "router-main"));
    await waitFor(() =>
      expect(result.current.blocked).toBe(
        "router-main is archived. An archived credential takes no check.",
      ),
    );
  });

  it("blocks with the ApiError message when the credential read fails", async () => {
    vi.mocked(readCredential).mockRejectedValue(
      new ApiError("not_found", "The credential does not exist.", 404),
    );
    const { result } = renderHook(() => useCredentialVerifyAction("llm", "router-main"));
    await waitFor(() =>
      expect(result.current.blocked).toBe(
        "router-main was not read: The credential does not exist.",
      ),
    );
  });
});
