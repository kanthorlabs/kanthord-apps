import { Button } from "@/components/ui/button";
import {
  EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES,
  useEvidenceDownload,
} from "@/features/projects/view/use-evidence-download";
import type { EvidenceReadFacts } from "@/lib/workbench-chat";
import { InlineError } from "./inline-error";

export function EvidenceRow({ facts }: { readonly facts: EvidenceReadFacts }) {
  const { download, pending, error } = useEvidenceDownload();
  const downloadable = facts.size <= EVIDENCE_DOWNLOAD_BLOB_MAX_BYTES;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        aria-label="Evidence read"
        role="group"
        className={
          error === null
            ? "flex min-w-0 flex-col gap-1 rounded-md border px-3 py-2 text-sm"
            : "flex min-w-0 flex-col gap-1 rounded-md border border-destructive px-3 py-2 text-sm"
        }
      >
        <span className="font-mono text-xs break-all">{facts.asset_id}</span>
        <span className="break-words text-muted-foreground">
          {facts.media_type}, {facts.size} bytes, range {facts.offset}–{facts.offset + facts.length}
          {facts.truncated ? ", truncated" : ""}
        </span>
        {downloadable ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="self-start"
            disabled={pending}
            onClick={() => void download(facts.asset_id)}
          >
            Download
          </Button>
        ) : (
          <span className="break-words">
            Too large for the dashboard. Use{" "}
            <code className="font-mono text-xs break-all">
              kanthord mission evidence asset content get {facts.asset_id}
            </code>
            .
          </span>
        )}
      </div>
      {error !== null && <InlineError code={null} message={`${error.detail}: ${error.message}`} />}
    </div>
  );
}
