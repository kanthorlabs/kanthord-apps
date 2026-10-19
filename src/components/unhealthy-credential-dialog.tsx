import { Fragment, type ReactNode } from "react";

import { RecordName } from "@/components/record-name";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type UnhealthyAction =
  { readonly kind: "enable"; readonly agentNames: readonly string[] } | { readonly kind: "create" };

interface UnhealthyCredentialDialogProps {
  readonly action: UnhealthyAction;
  readonly credential: string | null;
  readonly hint: string | null;
  readonly saferPath: ReactNode;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function EnableConsequence({
  credential,
  agentNames,
}: {
  credential: string | null;
  agentNames: readonly string[];
}) {
  return (
    <>
      The verify of <RecordName>{credential}</RecordName> answered unhealthy. Every session of{" "}
      {agentNames.map((agentName, index) => (
        <Fragment key={agentName}>
          {index > 0 && " and "}
          <RecordName>{agentName}</RecordName>
        </Fragment>
      ))}{" "}
      fails until the credential works.
    </>
  );
}

function CreateConsequence({ credential }: { credential: string | null }) {
  return (
    <>
      The check of the typed secret answered unhealthy. Every agent session that uses{" "}
      <RecordName>{credential}</RecordName> fails until the secret works.
    </>
  );
}

export function UnhealthyCredentialDialog({
  action,
  credential,
  hint,
  saferPath,
  onConfirm,
  onCancel,
}: UnhealthyCredentialDialogProps) {
  return (
    <AlertDialog open={credential !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {action.kind === "enable"
              ? `Enable ${action.agentNames.join(" and ")} with an unhealthy credential?`
              : "Create the credential with an unhealthy secret?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {action.kind === "enable" ? (
              <EnableConsequence credential={credential} agentNames={action.agentNames} />
            ) : (
              <CreateConsequence credential={credential} />
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hint !== null && <p className="text-sm text-muted-foreground">{hint}</p>}
        <p className="text-sm text-muted-foreground">{saferPath}</p>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {action.kind === "enable" ? "Enable anyway" : "Create anyway"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
