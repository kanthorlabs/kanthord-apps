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

interface UnhealthyCredentialDialogProps {
  readonly agentNames: readonly string[];
  readonly credential: string | null;
  readonly saferPath: ReactNode;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function UnhealthyCredentialDialog({
  agentNames,
  credential,
  saferPath,
  onConfirm,
  onCancel,
}: UnhealthyCredentialDialogProps) {
  return (
    <AlertDialog open={credential !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Enable {agentNames.join(" and ")} with an unhealthy credential?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The verify of <RecordName>{credential}</RecordName> answered unhealthy. Every session of{" "}
            {agentNames.map((agentName, index) => (
              <Fragment key={agentName}>
                {index > 0 && " and "}
                <RecordName>{agentName}</RecordName>
              </Fragment>
            ))}{" "}
            fails until the credential works.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{saferPath}</p>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Enable anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
