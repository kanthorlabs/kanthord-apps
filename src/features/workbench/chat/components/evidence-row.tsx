import { Button } from "@/components/ui/button";
import {
  evidenceSizeAction,
  useEvidenceDownload,
} from "@/features/projects/view/use-evidence-download";
import { byteText } from "@/lib/format";
import type { EvidenceReadFacts } from "@/lib/workbench-chat";
import { InlineError } from "./inline-error";

function grouped(value: number): string {
  return value.toLocaleString("en-US");
}

function rangeText({ offset, length }: EvidenceReadFacts): string {
  if (length === 0) return "0 bytes";
  return `bytes ${grouped(offset)}–${grouped(offset + length - 1)}`;
}

export function EvidenceRow({ facts }: { readonly facts: EvidenceReadFacts }) {
  const { download, pending, error } = useEvidenceDownload();
  const action = evidenceSizeAction(facts.size);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <details
        className={
          error === null
            ? "evrow min-w-0 rounded-md border px-3 py-2 text-sm"
            : "evrow min-w-0 rounded-md border border-destructive px-3 py-2 text-sm"
        }
      >
        <summary className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">tool</span>
          <code className="font-mono">evidence_read</code>
          <span className="break-all">
            · {facts.asset_id} · {facts.media_type} · {byteText(facts.size)} · {rangeText(facts)}
          </span>
          {action === "download" ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void download(facts.asset_id);
              }}
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
        </summary>
        <p className="mt-1 font-mono text-[11.5px] break-words text-muted-foreground">
          {facts.node_id} · attempt {grouped(facts.attempt)} · offset {grouped(facts.offset)} ·
          length {grouped(facts.length)} · truncated {facts.truncated ? "true" : "false"}
        </p>
      </details>
      {error !== null && (
        <InlineError
          code={null}
          message={error.detail === "" ? error.message : `${error.detail}: ${error.message}`}
        />
      )}
    </div>
  );
}
