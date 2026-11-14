import { useCallback, useState } from "react";

import type { ApiError } from "@/api/errors";
import { downloadEvidenceAsset } from "@/api/resources/mission";
import type { MissionEvidenceAsset } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export const EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES = 536870912;

export type EvidenceAssetAction = "download" | "too_large" | "none";

export function evidenceSizeAction(size: number): "download" | "too_large" {
  return size <= EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES ? "download" : "too_large";
}

export function evidenceAssetAction(asset: MissionEvidenceAsset): EvidenceAssetAction {
  if (asset.kind === "produced") return "download";
  if (asset.kind !== "object" || asset.published_at === null) return "none";
  return evidenceSizeAction(asset.size);
}

export interface EvidenceDownloadState {
  readonly download: (assetId: string) => Promise<void>;
  readonly pending: boolean;
  readonly error: ApiError | null;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.hidden = true;
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function useEvidenceDownload(): EvidenceDownloadState {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const download = useCallback(async (assetId: string) => {
    setPending(true);
    setError(null);
    try {
      const { blob, filename } = await downloadEvidenceAsset(assetId);
      saveBlob(blob, filename);
    } catch (cause) {
      setError(asApiError(cause));
    } finally {
      setPending(false);
    }
  }, []);

  return { download, pending, error };
}
