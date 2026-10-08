import { PlusIcon } from "lucide-react";

import type { BindingSetKind } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useBindingEditor } from "../use-binding-editor";
import { useBindingVerify } from "../use-binding-verify";
import { BindingGuardDialog } from "./binding-guard-dialog";
import { BindingItem } from "./binding-item";
import { BindingSheet } from "./binding-sheet";

const SECTIONS: readonly { readonly kind: BindingSetKind; readonly label: string }[] = [
  { kind: "repository", label: "Repositories" },
  { kind: "worker", label: "Workers" },
  { kind: "storage", label: "Storage" },
];

interface BindingsPanelProps {
  projectId: string;
  onWritten: () => void;
}

export function BindingsPanel({ projectId, onWritten }: BindingsPanelProps) {
  const editor = useBindingEditor(projectId, onWritten);
  const { bindings, guard, target } = editor;
  const { data, error, loading, reload } = bindings.resource;
  const current = data?.bindings ?? {};

  const bindingVerify = useBindingVerify(projectId, data?.version ?? null);

  if (loading && data === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">{error?.message}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {target === null && bindings.conflict && (
        <Alert variant="destructive">
          <AlertDescription>
            Someone else saved the binding set. The list now shows the new state.
          </AlertDescription>
        </Alert>
      )}
      {target === null && bindings.error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{bindings.error.message}</AlertDescription>
        </Alert>
      )}
      {SECTIONS.map((section) => {
        const entries = Object.entries(current).filter(([, entry]) => entry.kind === section.kind);
        return (
          <section key={section.kind} aria-label={section.label} className="flex flex-col gap-2">
            <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
              <h3 className="font-semibold">
                {section.label}{" "}
                <span className="text-muted-foreground tabular-nums">({entries.length})</span>
              </h3>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Add ${section.label.toLowerCase()} binding`}
                onClick={() => editor.openTarget({ kind: section.kind, name: null, entry: null })}
              >
                <PlusIcon aria-hidden="true" data-icon="inline-start" />
                Add
              </Button>
            </div>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {section.label.toLowerCase()} binding.
              </p>
            ) : (
              <ItemGroup aria-label={section.label} className="gap-2">
                {entries.map(([name, entry]) => {
                  const bindingId = bindingVerify.bindingIdOf(name);
                  return (
                    <BindingItem
                      key={name}
                      name={name}
                      entry={entry}
                      bindingId={bindingId}
                      revision={bindingVerify.revisionOf(name)}
                      verifyState={bindingVerify.getState(bindingId)}
                      onVerify={() => {
                        if (bindingId !== null) bindingVerify.verify(bindingId);
                      }}
                      onEdit={() => editor.openTarget({ kind: entry.kind, name, entry })}
                      onRemove={() => editor.propose(name, null)}
                    />
                  );
                })}
              </ItemGroup>
            )}
          </section>
        );
      })}
      {target !== null && (
        <BindingSheet
          key={`${target.kind}:${target.name ?? "new"}`}
          projectId={projectId}
          target={target}
          bindingId={target.name === null ? null : bindingVerify.bindingIdOf(target.name)}
          takenNames={Object.keys(current)}
          saving={bindings.saving}
          conflict={bindings.conflict}
          errorMessage={bindings.error?.message ?? null}
          onSave={editor.propose}
          onClose={editor.closeTarget}
        />
      )}
      <BindingGuardDialog
        guard={guard}
        saving={bindings.saving}
        onConfirm={editor.confirmGuarded}
        onSafer={editor.takeSaferPath}
      />
    </div>
  );
}
