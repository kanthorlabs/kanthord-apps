import { useId } from "react";

import type { ScopeRequest } from "@/api/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScopeRequestReview } from "../use-scope-request-review";
import { InlineError } from "./inline-error";

interface ScopeRequestDialogProps {
  readonly sessionId: string;
  readonly request: ScopeRequest;
  readonly onClose: () => void;
  readonly onResolved: (requestId: string) => void;
}

export function ScopeRequestDialog({
  sessionId,
  request,
  onClose,
  onResolved,
}: ScopeRequestDialogProps) {
  const fieldId = useId();
  const review = useScopeRequestReview(sessionId, request, () => onResolved(request.id));
  const name = review.confirmName ?? "…";
  return (
    <AlertDialog open onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Run an act outside the shared projects</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            {review.requestedLine}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid min-w-0 gap-3 text-sm">
          {!review.settled && <p role="status">Reading the project…</p>}
          {review.readFailure !== null && <InlineError code={null} message={review.readFailure} />}
          {review.consequence !== null && (
            <p className="break-words">
              {review.consequence.map((part, index) =>
                part.bold ? (
                  <strong key={index}>{part.text}</strong>
                ) : (
                  <span key={index}>{part.text}</span>
                ),
              )}
            </p>
          )}
          {review.facts.length > 0 && (
            <ul aria-label="Facts of the request" className="grid min-w-0 gap-1">
              {review.facts.map((fact) => (
                <li key={fact} className="break-words">
                  {fact}
                </li>
              ))}
            </ul>
          )}
          {review.settled && (
            <p className="break-words">
              Shared in this conversation:{" "}
              {review.sharedNames.length === 0 ? "none" : review.sharedNames.join(", ")}
            </p>
          )}
          <div className="grid min-w-0 gap-1">
            <h3 className="font-semibold">Input written by the agent</h3>
            <pre className="max-h-48 overflow-auto rounded-md border p-2 font-mono text-xs break-words whitespace-pre-wrap">
              {JSON.stringify(request.input, null, 2)}
            </pre>
          </div>
          {review.unavailableReason !== null && (
            <p role="status" className="text-destructive">
              {review.unavailableReason}
            </p>
          )}
          <div className="grid min-w-0 gap-1">
            <label htmlFor={fieldId}>
              Type <strong className="break-all text-destructive">{name}</strong> to confirm
            </label>
            <Input
              id={fieldId}
              autoComplete="off"
              spellCheck={false}
              placeholder={review.confirmName ?? ""}
              disabled={review.confirmName === null}
              value={review.typed}
              onChange={(event) => review.setTyped(event.target.value)}
            />
          </div>
          <p className="break-words text-muted-foreground">{review.saferPath}</p>
          {review.failure !== null && (
            <InlineError code={review.failure.code} message={review.failure.message} />
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={review.pending}>Cancel</AlertDialogCancel>
          <Button variant="outline" disabled={review.pending} onClick={() => void review.reject()}>
            Reject
          </Button>
          <Button
            variant="destructive"
            disabled={!review.canApprove}
            onClick={() => void review.approve()}
          >
            Run on {name}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
