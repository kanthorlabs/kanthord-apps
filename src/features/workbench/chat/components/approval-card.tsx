import { useId } from "react";

import type { WorkbenchPendingApproval } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { ChatActionFailure } from "../use-chat-actions";
import { InlineError } from "./inline-error";

interface ApprovalCardProps {
  readonly approval: WorkbenchPendingApproval;
  readonly busy: boolean;
  readonly failure: ChatActionFailure | null;
  readonly onDecide: (approved: boolean) => void;
}

export function ApprovalCard({ approval, busy, failure, onDecide }: ApprovalCardProps) {
  const errorId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className={failure === null ? undefined : "rounded-xl border border-destructive"}>
        <Card
          size="sm"
          role="group"
          aria-label="Approval Required"
          aria-describedby={failure === null ? undefined : errorId}
        >
          <CardHeader>
            <h3 className="font-semibold leading-none">Approval Required</h3>
            <p className="text-sm text-muted-foreground">
              The agent asks to run a mutation. The call waits for your decision.
            </p>
          </CardHeader>
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
