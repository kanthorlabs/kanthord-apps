import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { downloadEvidenceAsset } from "@/api/resources/mission";
import { EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES, useEvidenceDownload } from "./use-evidence-download";

vi.mock("@/api/resources/mission", () => ({ downloadEvidenceAsset: vi.fn() }));

const createObjectURL = vi.fn(() => "blob:evidence-1");
const revokeObjectURL = vi.fn();
const open = vi.fn();
let clicked: { download: string; href: string }[] = [];

beforeEach(() => {
  vi.clearAllMocks();
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
