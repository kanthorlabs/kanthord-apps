import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import type { HostKey, HostKeyScan } from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { toast } from "sonner";
import { HostKeyPanel } from "./host-key-panel";

const GITHUB_FINGERPRINT = "SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU";
const GITLAB_FINGERPRINT = "SHA256:eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8";
const OTHER_FINGERPRINT = "SHA256:otherotherotherotherotherotherotherotherott";

const GITHUB: HostKey = {
  host: "github.com",
  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl",
  fingerprint: GITHUB_FINGERPRINT,
  source: "github_meta",
  created_at: Date.UTC(2026, 9, 1, 9, 0),
};
const GITLAB: HostKey = {
  host: "gitlab.com",
  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAfuCHKVTjquxvt6CM6tdG4SLp1Btn/nOeHHE5UOzRdf",
  fingerprint: GITLAB_FINGERPRINT,
  source: "keyscan",
  created_at: Date.UTC(2026, 9, 2, 9, 0),
};

function scanOf(item: HostKey, fingerprint = item.fingerprint): HostKeyScan {
  return { host: item.host, public_key: item.public_key, fingerprint, source: item.source };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialsApi.listHostKeys).mockResolvedValue([GITHUB, GITLAB]);
});

describe("HostKeyPanel", () => {
  it("shows each pin with its host, fingerprint, source and pin time", async () => {
    render(<HostKeyPanel />);

    const list = await screen.findByRole("list", { name: "Host keys" });
    const items = within(list).getAllByRole("listitem");
    expect(within(items[0]!).getByText("github.com")).toBeTruthy();
    expect(within(items[0]!).getByText(GITHUB_FINGERPRINT)).toBeTruthy();
    expect(within(items[0]!).getByText("api.github.com")).toBeTruthy();
    expect(within(items[0]!).getByText("2026-10-01 09:00 UTC")).toBeTruthy();
    expect(within(items[1]!).getByText("ssh-keyscan")).toBeTruthy();
    expect(within(items[1]!).getByRole("button", { name: "Pin again gitlab.com" })).toBeTruthy();
  });

  it("pins a GitHub host again from api.github.com without a human confirmation", async () => {
    vi.mocked(credentialsApi.scanHostKey).mockResolvedValue(scanOf(GITHUB));
    vi.mocked(credentialsApi.pinHostKey).mockResolvedValue(GITHUB);
    render(<HostKeyPanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Pin again github.com" }));

    await waitFor(() =>
      expect(credentialsApi.pinHostKey).toHaveBeenCalledWith("github.com", {
        fingerprint: GITHUB_FINGERPRINT,
      }),
    );
    expect(credentialsApi.scanHostKey).toHaveBeenCalledWith("github.com");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith(
      "Host key of github.com pinned from api.github.com.",
      { description: GITHUB_FINGERPRINT },
    );
    await waitFor(() => expect(credentialsApi.listHostKeys).toHaveBeenCalledTimes(2));
  });

  it("asks a human to confirm the fingerprint of another host before the pin", async () => {
    vi.mocked(credentialsApi.scanHostKey).mockResolvedValue(scanOf(GITLAB, OTHER_FINGERPRINT));
    vi.mocked(credentialsApi.pinHostKey).mockResolvedValue({
      ...GITLAB,
      fingerprint: OTHER_FINGERPRINT,
    });
    render(<HostKeyPanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Pin again gitlab.com" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Confirm the host key of gitlab.com",
    });
    expect(within(dialog).getByText(OTHER_FINGERPRINT)).toBeTruthy();
    expect(within(dialog).getByText(GITLAB_FINGERPRINT)).toBeTruthy();
    expect(within(dialog).getByText(/differs from the pinned key/)).toBeTruthy();
    expect(
      within(dialog).getByRole("link", { name: "Published fingerprints of gitlab.com" }),
    ).toHaveAttribute(
      "href",
      "https://docs.gitlab.com/user/gitlab_com/#ssh-host-keys-fingerprints",
    );
    expect(credentialsApi.pinHostKey).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm host key" }));

    expect(credentialsApi.pinHostKey).toHaveBeenCalledWith("gitlab.com", {
      fingerprint: OTHER_FINGERPRINT,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("pins nothing when the human cancels the confirmation", async () => {
    vi.mocked(credentialsApi.scanHostKey).mockResolvedValue(scanOf(GITLAB));
    render(<HostKeyPanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Pin again gitlab.com" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("The scanned key equals the pinned key.")).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(credentialsApi.pinHostKey).not.toHaveBeenCalled();
  });

  it("shows a changed key between the scan and the pin in the confirmation", async () => {
    vi.mocked(credentialsApi.scanHostKey).mockResolvedValue(scanOf(GITLAB));
    vi.mocked(credentialsApi.pinHostKey).mockRejectedValue(
      new ApiError("conflict", "Changed.", 409, "repository.host_key.changed", {
        host: "gitlab.com",
        fingerprint: OTHER_FINGERPRINT,
      }),
    );
    render(<HostKeyPanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Pin again gitlab.com" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm host key" }));

    expect(await within(dialog).findByText("The host key was not pinned.")).toBeTruthy();
    expect(within(dialog).getByText(/The host now presents SHA256:other/)).toBeTruthy();
  });

  it("reports a failed scan in a toast", async () => {
    vi.mocked(credentialsApi.scanHostKey).mockRejectedValue(
      new ApiError("refused", "Scan failed.", 422, "repository.host_key.scan_failed", {
        host: "gitlab.com",
      }),
    );
    render(<HostKeyPanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Pin again gitlab.com" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The host key of gitlab.com was not pinned.", {
        description:
          "The server cannot read the host key of gitlab.com. Check the network of the server, then try again.",
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("states an empty list and a failed read with Retry", async () => {
    vi.mocked(credentialsApi.listHostKeys)
      .mockRejectedValueOnce(new ApiError("unavailable", "The daemon did not answer.", 503))
      .mockResolvedValue([]);
    render(<HostKeyPanel />);

    expect(await screen.findByText("The daemon did not answer.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText(
        "No host key is pinned. A binding sheet pins the host of its address.",
      ),
    ).toBeTruthy();
  });
});
