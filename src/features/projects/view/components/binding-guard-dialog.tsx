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
import { Button } from "@/components/ui/button";
import type { BindingChangeGuardState } from "../use-binding-change-guard";

interface BindingGuardDialogProps {
  readonly guard: BindingChangeGuardState;
  readonly saving: boolean;
  readonly onConfirm: () => void;
  readonly onSafer: () => void;
}

export function BindingGuardDialog({ guard, saving, onConfirm, onSafer }: BindingGuardDialogProps) {
  const { change, nodes, nodesError } = guard;

  return (
    <AlertDialog open={change !== null} onOpenChange={(open) => !open && guard.close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{guard.confirmLabel}?</AlertDialogTitle>
          <AlertDialogDescription>{guard.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <section aria-label="Mission nodes that name the binding" className="text-sm">
          {nodesError !== null ? (
            <p className="text-destructive">
              The mission nodes could not be read: {nodesError.message}
            </p>
          ) : nodes === null ? (
            <p className="text-muted-foreground">Reading the mission nodes that name it…</p>
          ) : nodes.length === 0 ? (
            <p className="text-muted-foreground">No current mission node names it.</p>
          ) : (
            <>
              <p>
                {nodes.length} current mission nodes name it. Records that pin an earlier revision
                are not listed here.
              </p>
              <ul className="mt-1 list-disc pl-4">
                {nodes.map((node) => (
                  <li key={node.filename} className="break-words">
                    {node.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {change?.kind === "remove" ? "Cancel" : (guard.saferLabel ?? "Cancel")}
          </AlertDialogCancel>
          {change?.kind === "remove" && guard.saferLabel !== null && (
            <Button variant="outline" disabled={saving} onClick={onSafer}>
              {guard.saferLabel}
            </Button>
          )}
          <AlertDialogAction variant="destructive" disabled={saving} onClick={onConfirm}>
            {guard.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
