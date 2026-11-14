import { useCallback, useState } from "react";

import type { ApiError } from "@/api/errors";
import { downloadEvidenceAsset } from "@/api/resources/mission";
import { asApiError } from "@/hooks/use-resource";

export const EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES = 536870912;

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
