import { useId } from "react";

import type { WorkbenchPendingApproval } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ChatActionFailure } from "../use-chat-actions";
import { useEvidenceAllow } from "../use-evidence-allow";
import { InlineError } from "./inline-error";

interface EvidenceDangerCardProps {
  readonly approval: WorkbenchPendingApproval;
  readonly agentDisplayName: string;
  readonly busy: boolean;
  readonly failure: ChatActionFailure | null;
  readonly onDecide: (approved: boolean) => void;
  readonly onAllowed: () => void;
}

const TITLE = "Evidence read in a shared conversation";
const EVIDENCE_FACTS = ["node_id", "attempt", "asset_id", "kind"] as const;

export function EvidenceDangerCard({
  approval,
  agentDisplayName,
  busy,
  failure,
  onDecide,
  onAllowed,
}: EvidenceDangerCardProps) {
  const errorId = useId();
  const fieldId = useId();
  const allow = useEvidenceAllow(approval, onAllowed);
  const line = allow.failure ?? failure;
  const { input } = approval;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="rounded-xl border border-destructive">
        <Card
          size="sm"
          role="group"
          aria-label={TITLE}
          aria-describedby={line === null ? undefined : errorId}
        >
          <CardHeader>
            <h3 className="leading-none font-semibold">{TITLE}</h3>
            <p className="text-sm break-words">
              Guests see every answer in this conversation. {agentDisplayName} can quote this
              evidence to them.
            </p>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-2 text-sm">
            {EVIDENCE_FACTS.map((key) => (
              <p key={key} className="min-w-0 font-mono break-all">
                {key}: {String(input[key])}
              </p>
            ))}
            <p>
              Allow lets this conversation read every evidence asset of node{" "}
              {String(input["node_id"])} until kanthord restarts or a new invite is created.
            </p>
            <div className="grid min-w-0 gap-1">
              <label htmlFor={fieldId}>
                Type <strong className="break-all text-destructive">{allow.nodeName ?? "…"}</strong>{" "}
                to allow
              </label>
              <Input
                id={fieldId}
                autoComplete="off"
                spellCheck={false}
                placeholder={allow.nodeName ?? ""}
                disabled={allow.nodeName === null}
                value={allow.typed}
                onChange={(event) => allow.setTyped(event.target.value)}
              />
              {line !== null && (
                <InlineError id={errorId} code={line.code} message={line.message} />
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:max-sm:w-full">
            <Button
              variant="outline"
              disabled={busy || allow.pending}
              onClick={() => onDecide(false)}
            >
              Reject
            </Button>
            <Button disabled={!allow.canAllow || allow.pending} onClick={() => void allow.allow()}>
              Allow
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
