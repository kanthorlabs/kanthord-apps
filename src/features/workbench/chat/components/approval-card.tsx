import { useId } from "react";

import type { WorkbenchPendingApproval } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EVIDENCE_DOWNLOAD_OPERATION_ID } from "@/lib/approval-attention";
import type { ChatActionFailure } from "../use-chat-actions";
import { InlineError } from "./inline-error";

interface ApprovalCardProps {
  readonly approval: WorkbenchPendingApproval;
  readonly agentDisplayName: string;
  readonly busy: boolean;
  readonly failure: ChatActionFailure | null;
  readonly onDecide: (approved: boolean) => void;
}

const EVIDENCE_FACTS = ["node_id", "attempt", "asset_id", "kind"] as const;

function EvidenceBody({
  approval,
  agentDisplayName,
}: Pick<ApprovalCardProps, "approval" | "agentDisplayName">) {
  const { input } = approval;
  return (
    <CardContent className="grid min-w-0 gap-2 text-sm">
      <p className="min-w-0 break-words">agent: {agentDisplayName}</p>
      {EVIDENCE_FACTS.map((key) => (
        <p key={key} className="min-w-0 font-mono break-all">
          {key}: {String(input[key])}
        </p>
      ))}
      <p>
        Approve lets this conversation read every evidence asset of node {String(input["node_id"])}{" "}
        until kanthord restarts.
      </p>
    </CardContent>
  );
}

function GenericBody({ approval }: Pick<ApprovalCardProps, "approval">) {
  return (
    <CardContent className="grid min-w-0 gap-2 text-sm">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="shrink-0 text-muted-foreground">Operation ID</span>
        <span className="min-w-0 font-mono break-all">{approval.operation_id}</span>
      </div>
      <div className="grid min-w-0 gap-1">
        <span className="text-muted-foreground">Input</span>
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-xs break-words whitespace-pre-wrap">
          {JSON.stringify(approval.input, null, 2)}
        </pre>
      </div>
    </CardContent>
  );
}

export function ApprovalCard({
  approval,
  agentDisplayName,
  busy,
  failure,
  onDecide,
}: ApprovalCardProps) {
  const errorId = useId();
  const evidence = approval.operation_id === EVIDENCE_DOWNLOAD_OPERATION_ID;
  const title = evidence ? "Evidence read" : "Approval Required";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className={failure === null ? undefined : "rounded-xl border border-destructive"}>
        <Card
          size="sm"
          role="group"
          aria-label={title}
          aria-describedby={failure === null ? undefined : errorId}
        >
          <CardHeader>
            <h3 className="font-semibold leading-none">{title}</h3>
            {!evidence && (
              <p className="text-sm text-muted-foreground">
                The agent asks to run a mutation. The call waits for your decision.
              </p>
            )}
          </CardHeader>
          {evidence ? (
            <EvidenceBody approval={approval} agentDisplayName={agentDisplayName} />
          ) : (
            <GenericBody approval={approval} />
          )}
          <CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:max-sm:w-full">
            <Button variant="outline" disabled={busy} onClick={() => onDecide(false)}>
              Reject
            </Button>
            <Button disabled={busy} onClick={() => onDecide(true)}>
              Approve
            </Button>
          </CardFooter>
        </Card>
      </div>
      {failure !== null && (
        <InlineError id={errorId} code={failure.code} message={failure.message} />
      )}
    </div>
  );
}
