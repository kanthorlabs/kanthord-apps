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
import type { EnablementSwitchState } from "@/hooks/use-enablement-switch";

interface EnablementDisableDialogProps {
  readonly agentName: string;
  readonly control: EnablementSwitchState;
}

export function EnablementDisableDialog({ agentName, control }: EnablementDisableDialogProps) {
  const name = <RecordName>{agentName}</RecordName>;
  return (
    <AlertDialog open={control.confirming} onOpenChange={(open) => !open && control.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disable {agentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Disable stops {name} on the whole server. No worker binding of any project that names{" "}
            {name} claims new work, and the model calls of a live execution of it fail. The bindings
            stay, and Enable restores them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">
          To stop the work of one project only, pause that project instead. To keep {name} enabled,
          cancel.
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={control.pending}>Keep the agent enabled</AlertDialogCancel>
          <AlertDialogAction disabled={control.pending} onClick={control.confirm}>
            Disable agent
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
