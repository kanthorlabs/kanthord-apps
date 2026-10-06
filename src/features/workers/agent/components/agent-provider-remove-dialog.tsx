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
import type { AgentProviderRemoveState } from "../use-agent-provider-remove";

export function AgentProviderRemoveDialog({
  agentName,
  remove,
}: {
  agentName: string;
  remove: AgentProviderRemoveState;
}) {
  const name = remove.providerName ?? "";
  return (
    <AlertDialog
      open={remove.providerName !== null}
      onOpenChange={(open) => !open && remove.cancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove {name} from {agentName}?
          </AlertDialogTitle>
          <AlertDialogDescription>{remove.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{remove.saferPath}</p>
        {remove.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {remove.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.removing}>Keep {name}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.removing}
            onClick={remove.confirm}
          >
            Remove {name}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
