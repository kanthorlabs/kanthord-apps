import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { InstanceForm } from "./components/instance-form";
import { InstanceList } from "./components/instance-list";
import { RemoveInstanceDialog } from "./components/remove-instance-dialog";
import { DRAFT_VERIFY_KEY, type FormMode } from "./use-instance-form";
import type { InstanceManagerState } from "./use-instance-manager";
import type { InstancesState } from "./use-instances";

interface InstanceManagerProps {
  readonly store: InstancesState;
  readonly manager: InstanceManagerState;
}

const TITLE: Record<FormMode["kind"], string> = {
  list: "Instances",
  add: "Add instance",
  edit: "Edit instance",
};

export function InstanceManager({ store, manager }: InstanceManagerProps) {
  const { open, onOpenChange, dialogRef, verify, form, removal } = manager;
  const listing = form.mode.kind === "list";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogRef}>
        <DialogHeader>
          <DialogTitle>{TITLE[form.mode.kind]}</DialogTitle>
          <DialogDescription>
            This browser keeps the list of KanthorD instances. Verify checks that an instance
            answers.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 max-h-[60svh] min-w-0 overflow-y-auto px-1 py-1">
          {!listing ? (
            <InstanceForm form={form} verifyState={verify.states[DRAFT_VERIFY_KEY]} />
          ) : store.instances.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No instances</EmptyTitle>
                <EmptyDescription>
                  Add the URL of a KanthorD instance to sign in to it.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={form.startAdd}>Add instance</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <InstanceList
              instances={store.instances}
              defaultId={store.defaultId}
              verifyStates={verify.states}
              onVerify={(instance) => void verify.verify(instance.id, instance.baseUrl)}
              onEdit={form.startEdit}
              onSetDefault={store.setDefault}
              onRemove={removal.request}
            />
          )}
        </div>
        {listing && store.instances.length > 0 && (
          <DialogFooter>
            <Button onClick={form.startAdd}>Add instance</Button>
          </DialogFooter>
        )}
        <RemoveInstanceDialog
          prompt={removal.prompt}
          onConfirm={removal.confirm}
          onCancel={removal.cancel}
        />
      </DialogContent>
    </Dialog>
  );
}
