import { PlusIcon } from "lucide-react";
import { useState } from "react";

import type { BindingSetKind, EnvironmentState, RepositoryBindingConfig } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useBindingEditor } from "../use-binding-editor";
import { useBindingVerify } from "../use-binding-verify";
import { useHostedWorkers } from "../use-hosted-workers";
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
  environments: readonly EnvironmentState[] | null;
  onWritten: () => void;
  onEnvironmentChanged: () => void;
}

export function BindingsPanel({
  projectId,
  environments,
  onWritten,
  onEnvironmentChanged,
}: BindingsPanelProps) {
  const editor = useBindingEditor(projectId, onWritten);
  const { bindings, guard, target } = editor;
  const { data, error, loading, reload } = bindings.resource;
  const current = data?.bindings ?? {};
  const repositoryNames = Object.entries(current)
    .filter(([, entry]) => entry.kind === "repository")
    .map(([name]) => name)
    .sort();

  const [sheetEpoch, setSheetEpoch] = useState(0);
  const bindingVerify = useBindingVerify(projectId, data?.version ?? null);
  const hostedWorkers = useHostedWorkers().data;

  const onEnvironmentWritten = (
    patch: Pick<RepositoryBindingConfig, "environment" | "environment_secrets">,
  ) => {
    if (target === null || target.entry?.kind !== "repository") return;
    editor.openTarget({
      ...target,
      entry: { kind: "repository", config: { ...target.entry.config, ...patch } },
      section: "environment",
    });
    setSheetEpoch((epoch) => epoch + 1);
    reload();
  };

  const environmentOf = (name: string, kind: BindingSetKind): EnvironmentState | null =>
    kind === "repository"
      ? (environments?.find((state) => state.binding_name === name) ?? null)
      : null;

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
          <AlertDescription>{bindings.error}</AlertDescription>
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
                      environment={environmentOf(name, entry.kind)}
                      hostedWorker={
                        entry.kind === "worker" &&
                        (hostedWorkers?.has(entry.config.worker) ?? false)
                      }
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
          key={`${target.kind}:${target.name ?? "new"}:${sheetEpoch}`}
          projectId={projectId}
          target={target}
          bindingId={target.name === null ? null : bindingVerify.bindingIdOf(target.name)}
          environment={target.name === null ? null : environmentOf(target.name, target.kind)}
          takenNames={Object.keys(current)}
          repositoryNames={repositoryNames}
          saving={bindings.saving}
          conflict={bindings.conflict}
          errorMessage={bindings.error}
          onSave={editor.propose}
          onEnvironmentChanged={onEnvironmentChanged}
          onEnvironmentWritten={onEnvironmentWritten}
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
