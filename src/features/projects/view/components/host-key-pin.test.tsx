import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import type { HostKey, HostKeyScan } from "@/api/types";

vi.mock("@/api/resources/credentials");

import { useHostKeyPin } from "../use-host-key-pin";
import { HostKeyPin } from "./host-key-pin";

const GITHUB_SCAN: HostKeyScan = {
  host: "github.com",
  public_key: "ssh-ed25519 AAAAgithub",
  fingerprint: "SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU",
  source: "github_meta",
};
const GITLAB_SCAN: HostKeyScan = {
  host: "gitlab.com",
  public_key: "ssh-ed25519 AAAAgitlab",
  fingerprint: "SHA256:eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8",
  source: "keyscan",
};
const OTHER_FINGERPRINT = "SHA256:Zm9yZWlnbi1rZXktb2YtYS1tYW4taW4tdGhlLW1pZGRsZQ";

function pinnedOf(scan: HostKeyScan): HostKey {
  return { ...scan, created_at: Date.UTC(2026, 9, 19, 9, 0) };
}

function Harness({ host }: { readonly host: string | null }) {
  const pin = useHostKeyPin(host);
  return (
    <>
      <HostKeyPin pin={pin} />
      <p>{pin.ready ? "Save ready" : "Save blocked"}</p>
    </>
  );
}

describe("HostKeyPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(credentialsApi.listHostKeys).mockResolvedValue([]);
  });

  it("shows a pinned host and reads no scan", async () => {
    vi.mocked(credentialsApi.listHostKeys).mockResolvedValue([pinnedOf(GITHUB_SCAN)]);
    render(<Harness host="github.com" />);

    expect(await screen.findByText("Pinned")).toBeTruthy();
    expect(screen.getByText(GITHUB_SCAN.fingerprint)).toBeTruthy();
    expect(screen.getByText("Save ready")).toBeTruthy();
    expect(credentialsApi.scanHostKey).not.toHaveBeenCalled();
  });

  it("pins a GitHub host from api.github.com without a confirm", async () => {
    vi.mocked(credentialsApi.scanHostKey).mockResolvedValue(GITHUB_SCAN);
    vi.mocked(credentialsApi.pinHostKey).mockResolvedValue(pinnedOf(GITHUB_SCAN));
    render(<Harness host="github.com" />);

    expect(await screen.findByText("Host key pinned from api.github.com")).toBeTruthy();
    expect(screen.getByText(GITHUB_SCAN.fingerprint)).toBeTruthy();
    expect(credentialsApi.pinHostKey).toHaveBeenCalledWith("github.com", {
      fingerprint: GITHUB_SCAN.fingerprint,
    });
    expect(screen.queryByRole("button", { name: "Confirm host key" })).toBeNull();
    expect(screen.getByText("Save ready")).toBeTruthy();
  });

  it("pins a GitLab host only after Confirm host key", async () => {
    vi.mocked(credentialsApi.scanHostKey).mockResolvedValue(GITLAB_SCAN);
    vi.mocked(credentialsApi.pinHostKey).mockResolvedValue(pinnedOf(GITLAB_SCAN));
    render(<Harness host="gitlab.com" />);

    const confirm = await screen.findByRole("button", { name: "Confirm host key" });
    expect(screen.getByText(GITLAB_SCAN.fingerprint)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Published fingerprints of gitlab.com" })).toBeTruthy();
    expect(screen.getByText("Save blocked")).toBeTruthy();
    expect(credentialsApi.pinHostKey).not.toHaveBeenCalled();

    await userEvent.click(confirm);

    expect(await screen.findByText("Pinned")).toBeTruthy();
    expect(credentialsApi.pinHostKey).toHaveBeenCalledWith("gitlab.com", {
      fingerprint: GITLAB_SCAN.fingerprint,
    });
    expect(screen.getByText("Save ready")).toBeTruthy();
  });

  it("shows both fingerprints when the host key changes between the reads", async () => {
    vi.mocked(credentialsApi.scanHostKey).mockResolvedValue(GITHUB_SCAN);
    vi.mocked(credentialsApi.pinHostKey).mockRejectedValue(
      new ApiError(
        "conflict",
        "The host presented another key on the second read.",
        409,
        "repository.host_key.changed",
        { host: "github.com", fingerprint: OTHER_FINGERPRINT },
      ),
    );
    render(<Harness host="github.com" />);

    expect(await screen.findByText("The host presented another key.")).toBeTruthy();
    expect(screen.getByText(GITHUB_SCAN.fingerprint)).toBeTruthy();
    expect(screen.getByText(OTHER_FINGERPRINT)).toBeTruthy();
    expect(screen.getByText("Save blocked")).toBeTruthy();
  });

  it("names a failed read and reads again on Retry", async () => {
    vi.mocked(credentialsApi.scanHostKey)
      .mockRejectedValueOnce(
        new ApiError("refused", "Scan failed.", 422, "repository.host_key.scan_failed", {
          host: "gitlab.com",
        }),
      )
      .mockResolvedValueOnce(GITLAB_SCAN);
    render(<Harness host="gitlab.com" />);

    expect(await screen.findByText("The host key of gitlab.com was not read.")).toBeTruthy();
    expect(screen.getByText("Save blocked")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("button", { name: "Confirm host key" })).toBeTruthy();
  });

  it("renders nothing and blocks nothing without a host", async () => {
    render(<Harness host={null} />);

    expect(screen.getByText("Save ready")).toBeTruthy();
    await waitFor(() => expect(credentialsApi.listHostKeys).not.toHaveBeenCalled());
  });
});
