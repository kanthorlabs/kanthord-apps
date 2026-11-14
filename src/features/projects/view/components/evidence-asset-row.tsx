import type { MissionEvidenceAsset } from "@/api/types";
import { Button } from "@/components/ui/button";
import { assetText } from "@/lib/mission-labels";
import { cn } from "cn";
import { EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES, useEvidenceDownload } from "../use-evidence-download";

function downloadable(asset: MissionEvidenceAsset): boolean {
  if (asset.kind === "produced") return true;
  return (
    asset.kind === "object" &&
    asset.published_at !== null &&
    asset.size <= EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES
  );
}

function tooLarge(asset: MissionEvidenceAsset): boolean {
  return (
    asset.kind === "object" &&
    asset.published_at !== null &&
    asset.size > EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES
  );
}

export function EvidenceAssetRow({ asset }: { readonly asset: MissionEvidenceAsset }) {
  const { download, pending, error } = useEvidenceDownload();

  return (
    <span className="flex flex-col gap-0.5">
      <span
        className={cn(
          "flex flex-wrap items-center gap-2",
          error !== null && "rounded-md border border-destructive px-2 py-1",
        )}
      >
        <span className="break-all">
          {assetText(asset)}
          {asset.published_at === null ? " (not published)" : ""}
        </span>
        {downloadable(asset) && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={pending}
            onClick={() => void download(asset.id)}
          >
            Download
          </Button>
        )}
      </span>
      {tooLarge(asset) && (
        <span className="break-words">
          Too large for the dashboard. Use{" "}
          <code className="font-mono text-xs break-all">
            kanthord mission evidence asset content get {asset.id}
          </code>
          .
        </span>
      )}
      {error !== null && (
        <span role="alert" className="break-words text-destructive">
          {error.detail}: {error.message}
        </span>
      )}
    </span>
  );
}
