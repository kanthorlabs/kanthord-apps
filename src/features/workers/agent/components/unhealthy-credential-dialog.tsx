import { Link } from "react-router-dom";

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
  readonly agentName: string;
  readonly credential: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function UnhealthyCredentialDialog({
  agentName,
  credential,
  onConfirm,
  onCancel,
}: UnhealthyCredentialDialogProps) {
  const name = credential ?? "";
  return (
    <AlertDialog open={credential !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enable {agentName} with an unhealthy credential?</AlertDialogTitle>
          <AlertDialogDescription>
            The verify of <RecordName>{name}</RecordName> answered unhealthy. Every session of{" "}
            <RecordName>{agentName}</RecordName> fails until the credential works.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">
          Rotate the secret on the{" "}
          <Link to={`/llm/${encodeURIComponent(name)}`} className="underline underline-offset-4">
            page of {name}
          </Link>{" "}
          first, then enable the agent.
        </p>
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
