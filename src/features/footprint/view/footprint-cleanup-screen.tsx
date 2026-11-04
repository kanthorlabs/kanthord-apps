import { ChevronDownIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CLEANUP_STATE_LABELS, refusalText } from "@/lib/footprint";
import { cleanupFacts, cleanupTitle } from "../cleanup-facts";
import { useFootprintCleanupRecord } from "./use-footprint-cleanup-record";

const STATE_NOTES: Readonly<Record<string, string>> = {
  queued: "The cleanup waits for its owner. The record updates every 15 seconds.",
  running: "The owner deletes the keys. The record updates every 15 seconds.",
  failed:
    "The owner could not run the cleanup. The outcome holds the keys that it removed before the failure. KanthorD rolls back nothing.",
  cancelled: "A human cancelled the cleanup before it ran. KanthorD deleted nothing.",
};

export function FootprintCleanupScreen() {
  const { cleanupId = "" } = useParams();
  const { record, live, cancelling, cancel } = useFootprintCleanupRecord(cleanupId);
  const [keysOpen, setKeysOpen] = useState(false);
  const value = record.data;

  if (value === null) {
    return record.error === null ? (
      <Skeleton className="h-32 w-full" />
    ) : (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">{record.error.message}</p>
        <Button variant="outline" size="sm" onClick={record.refresh}>
          Retry
        </Button>
      </div>
    );
  }

  const note = STATE_NOTES[value.state];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="min-w-0 text-lg font-semibold break-words">{cleanupTitle(value)}</h2>
          <Badge variant={value.state === "failed" ? "destructive" : "secondary"}>
            {CLEANUP_STATE_LABELS[value.state]}
          </Badge>
        </div>
        {value.state === "queued" && (
          <Button variant="outline" size="sm" disabled={cancelling} onClick={cancel}>
            <XIcon aria-hidden="true" data-icon="inline-start" />
            Cancel cleanup
          </Button>
        )}
      </div>
      <p className="font-mono text-sm break-all text-muted-foreground">{value.cleanup_id}</p>
      {note !== undefined && <p className="text-sm">{note}</p>}
      {record.error !== null && live && (
        <p role="alert" className="text-sm text-destructive">
          {record.error.message}
        </p>
      )}
      <dl className="grid gap-x-4 gap-y-2 text-sm md:grid-cols-[max-content_1fr]">
        {cleanupFacts(value).map((fact) => (
          <div key={fact.label} className="contents">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="min-w-0 break-words">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {value.outcome !== null && value.outcome.refused.length > 0 && (
        <section aria-labelledby="cleanup-refused" className="flex flex-col gap-2">
          <h3 id="cleanup-refused" className="font-semibold leading-none">
            Refused
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {value.outcome.refused.map((refused) => (
              <li key={refused.key} className="break-all">
                <span className="font-mono">{refused.key}</span>:{" "}
                {refusalText(value.kind, refused.reason)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-col items-start gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-expanded={keysOpen}
          onClick={() => setKeysOpen((open) => !open)}
        >
          <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
          {keysOpen ? "Hide keys" : `Show ${value.keys.length} keys`}
        </Button>
        <Reveal open={keysOpen}>
          <ul className="flex flex-col gap-1 font-mono text-sm break-all">
            {value.keys.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </Reveal>
      </div>
    </div>
  );
}
