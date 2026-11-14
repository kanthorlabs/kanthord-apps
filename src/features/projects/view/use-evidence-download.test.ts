import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { downloadEvidenceAsset } from "@/api/resources/mission";
import type { MissionEvidenceAsset } from "@/api/types";
import {
  EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES,
  evidenceAssetAction,
  evidenceSizeAction,
  useEvidenceDownload,
} from "./use-evidence-download";

vi.mock("@/api/resources/mission", () => ({ downloadEvidenceAsset: vi.fn() }));

const createObjectURL = vi.fn(() => "blob:evidence-1");
const revokeObjectURL = vi.fn();
const open = vi.fn();
let clicked: { download: string; href: string }[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  clicked = [];
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.stubGlobal("open", open);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ download: this.download, href: this.href });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useEvidenceDownload", () => {
  it("caps the blob at 512 MiB", () => {
    expect(EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES).toBe(512 * 1024 * 1024);
  });

  it("saves the blob through one object URL and revokes it", async () => {
    const blob = new Blob(["content"]);
    vi.mocked(downloadEvidenceAsset).mockResolvedValue({ blob, filename: "asset_1.txt" });
    const { result } = renderHook(() => useEvidenceDownload());

    await act(() => result.current.download("asset_1"));

    expect(downloadEvidenceAsset).toHaveBeenCalledWith("asset_1");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ download: "asset_1.txt", href: "blob:evidence-1" }]);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:evidence-1");
    expect(open).not.toHaveBeenCalled();
    expect(document.querySelector("a[download]")).toBeNull();
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("keeps the ApiError of a failed download and creates no object URL", async () => {
    const failure = new ApiError(
      "malformed",
      "The storage read failed.",
      502,
      "mission.evidence.content_unavailable",
    );
    vi.mocked(downloadEvidenceAsset).mockRejectedValue(failure);
    const { result } = renderHook(() => useEvidenceDownload());

    await act(() => result.current.download("asset_1"));

    expect(result.current.error).toBe(failure);
    expect(result.current.pending).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("clears the error when the next download starts", async () => {
    vi.mocked(downloadEvidenceAsset)
      .mockRejectedValueOnce(new ApiError("malformed", "The storage read failed.", 502, "x"))
      .mockResolvedValueOnce({ blob: new Blob(["a"]), filename: "asset_1.txt" });
    const { result } = renderHook(() => useEvidenceDownload());

    await act(() => result.current.download("asset_1"));
    await act(() => result.current.download("asset_1"));

    expect(result.current.error).toBeNull();
  });
});

function objectAsset(size: number, publishedAt: number | null): MissionEvidenceAsset {
  return {
    id: "asset_1",
    kind: "object",
    address: { kind: "object", location: "s3://bucket/asset_1" },
    storage_binding_id: "binding_1",
    size,
    media_type: "text/plain",
    published_at: publishedAt,
    expired_at: null,
  };
}

describe("evidenceAssetAction", () => {
  it("downloads a produced asset", () => {
    const produced: MissionEvidenceAsset = {
      id: "asset_1",
      kind: "produced",
      address: { kind: "produced", sha256: "a".repeat(64) },
      published_at: null,
      expired_at: null,
    };
    expect(evidenceAssetAction(produced)).toBe("download");
  });

  it("downloads a published object asset up to the cap", () => {
    expect(evidenceAssetAction(objectAsset(EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES, 1))).toBe("download");
  });

  it("refuses a published object asset above the cap", () => {
    expect(evidenceAssetAction(objectAsset(EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES + 1, 1))).toBe(
      "too_large",
    );
  });

  it("offers nothing for an unpublished object, a repository and a platform asset", () => {
    expect(evidenceAssetAction(objectAsset(10, null))).toBe("none");
    expect(
      evidenceAssetAction({
        id: "a",
        kind: "repository",
        address: { kind: "repository", binding_id: "b", commit: "c".repeat(40) },
        published_at: 1,
        expired_at: null,
      }),
    ).toBe("none");
    expect(
      evidenceAssetAction({
        id: "a",
        kind: "platform",
        address: { kind: "pull_request", resource_identity: "repository:github:a/b", number: 4 },
        published_at: 1,
        expired_at: null,
      }),
    ).toBe("none");
  });
});

describe("evidenceSizeAction", () => {
  it("downloads up to the cap and refuses above it", () => {
    expect(evidenceSizeAction(EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES)).toBe("download");
    expect(evidenceSizeAction(EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES + 1)).toBe("too_large");
  });
});
