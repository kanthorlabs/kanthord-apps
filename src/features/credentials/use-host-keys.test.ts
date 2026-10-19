import { act, renderHook, waitFor } from "@testing-library/react";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as credentialsApi from "@/api/resources/credentials";
import type { HostKey } from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useHostKeys } from "./use-host-keys";

const GITLAB: HostKey = {
  host: "gitlab.com",
  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAfuCHKVTjquxvt6CM6tdG4SLp1Btn/nOeHHE5UOzRdf",
  fingerprint: "SHA256:eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8",
  source: "keyscan",
  created_at: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialsApi.listHostKeys).mockResolvedValue([GITLAB]);
});

describe("useHostKeys", () => {
  it("scans once while a Pin again is in flight", async () => {
    vi.mocked(credentialsApi.scanHostKey).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useHostKeys());
    await waitFor(() => expect(result.current.list.loading).toBe(false));

    act(() => result.current.pinAgain(GITLAB));
    act(() => result.current.pinAgain(GITLAB));

    expect(credentialsApi.scanHostKey).toHaveBeenCalledTimes(1);
  });

  it("pins once while a confirmation is in flight", async () => {
    vi.mocked(credentialsApi.scanHostKey).mockResolvedValue({
      host: GITLAB.host,
      public_key: GITLAB.public_key,
      fingerprint: GITLAB.fingerprint,
      source: "keyscan",
    });
    vi.mocked(credentialsApi.pinHostKey).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useHostKeys());
    await waitFor(() => expect(result.current.list.loading).toBe(false));

    act(() => result.current.pinAgain(GITLAB));
    await waitFor(() => expect(result.current.confirmation).not.toBeNull());
    act(() => result.current.confirm());
    act(() => result.current.confirm());

    expect(credentialsApi.pinHostKey).toHaveBeenCalledTimes(1);
  });
});
