import type { MissionEvidenceAsset } from "@/api/types";
import { Button } from "@/components/ui/button";
import { assetText } from "@/lib/mission-labels";
import { cn } from "cn";
import { InlineError } from "@/features/workbench/chat/components/inline-error";
import { byteText } from "@/lib/format";
import { evidenceAssetAction, useEvidenceDownload } from "../use-evidence-download";

export function EvidenceAssetRow({ asset }: { readonly asset: MissionEvidenceAsset }) {
  const { download, pending, error } = useEvidenceDownload();
  const action = evidenceAssetAction(asset);

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
        {asset.kind === "object" && <span>{byteText(asset.size)}</span>}
        {action === "download" && (
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
      {action === "too_large" && (
        <span className="break-words">
          Too large for the dashboard. Use{" "}
          <code className="font-mono text-xs break-all">
            kanthord mission evidence asset content get {asset.id}
          </code>
          .
        </span>
      )}
      {error !== null && <InlineError code={error.detail} message={error.message} />}
    </span>
  );
}
