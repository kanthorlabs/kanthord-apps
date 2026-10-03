import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BindingSetEntry } from "@/api/types";
import { useBindingDraft, type BindingTarget } from "../use-binding-draft";
import { DraftField } from "./draft-field";
import { RepositoryForm } from "./repository-form";
import { StorageForm } from "./storage-form";
import { WorkerForm } from "./worker-form";

const KIND_LABELS = { repository: "repository", worker: "worker", storage: "storage" } as const;

interface BindingSheetProps {
  readonly target: BindingTarget;
  readonly takenNames: readonly string[];
  readonly saving: boolean;
  readonly conflict: boolean;
  readonly errorMessage: string | null;
  readonly onSave: (name: string, entry: BindingSetEntry) => void;
  readonly onClose: () => void;
}

export function BindingSheet({
  target,
  takenNames,
  saving,
  conflict,
  errorMessage,
  onSave,
  onClose,
}: BindingSheetProps) {
  const form = useBindingDraft(target, takenNames);
  const { draft, errors } = form;
  const kindLabel = KIND_LABELS[target.kind];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {form.creating ? `Add ${kindLabel} binding` : `Edit ${draft.name}`}
          </SheetTitle>
          <SheetDescription>
            A save writes the whole binding set at its current version.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          aria-label={form.creating ? `Add ${kindLabel} binding` : `Edit ${draft.name}`}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            const entry = form.validate();
            if (entry !== null) onSave(draft.name, entry);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            {conflict && (
              <Alert variant="destructive">
                <AlertTitle>The bindings changed.</AlertTitle>
                <AlertDescription>
                  Someone else saved the binding set. The list now shows the new state. Review your
                  change against it, then save again.
                </AlertDescription>
              </Alert>
            )}
            {errorMessage !== null && (
              <Alert variant="destructive">
                <AlertTitle>The binding was not saved.</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <FieldGroup>
              <DraftField
                id="binding-name"
                label="Name"
                value={draft.name}
                error={errors["name"]}
                readOnly={!form.creating}
                description={
                  form.creating
                    ? "Unique in the project. Mission nodes name the binding by it."
                    : "A new name removes the binding and adds another one, so the name is fixed here."
                }
                onChange={(name) => form.edit({ ...draft, name })}
              />
              {draft.kind === "repository" && (
                <RepositoryForm draft={draft} errors={errors} onEdit={form.edit} />
              )}
              {draft.kind === "worker" && (
                <WorkerForm
                  draft={draft}
                  errors={errors}
                  creating={form.creating}
                  onEdit={form.edit}
                />
              )}
              {draft.kind === "storage" && (
                <StorageForm draft={draft} errors={errors} onEdit={form.edit} />
              )}
            </FieldGroup>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={saving}>
              Save binding
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
