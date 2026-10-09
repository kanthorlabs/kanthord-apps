import { useCallback, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import type { BindingSetEntry, Credential } from "@/api/types";
import { CredentialCreateSheet } from "@/features/credentials/components/credential-create-sheet";
import { RotateSheet } from "@/features/credentials/components/rotate-sheet";
import { SshImportDialog } from "@/features/credentials/components/ssh-import-dialog";
import { newestLiveRevision } from "@/lib/credential-revisions";
import { useBindingCredential } from "../use-binding-credential";
import { useBindingCheck } from "../use-binding-check";
import { useBindingDraft, type BindingTarget } from "../use-binding-draft";
import { useRepositoryCredentials } from "../use-repository-credentials";
import { useWorkerAgents } from "../use-worker-agents";
import { useWorkerNames } from "../use-worker-names";
import { DraftField } from "./draft-field";
import { RepositoryForm } from "./repository-form";
import { StorageForm } from "./storage-form";
import { WorkerForm } from "./worker-form";

const KIND_LABELS = { repository: "repository", worker: "worker", storage: "storage" } as const;

interface BindingSheetProps {
  readonly projectId: string;
  readonly target: BindingTarget;
  readonly bindingId: string | null;
  readonly takenNames: readonly string[];
  readonly saving: boolean;
  readonly conflict: boolean;
  readonly errorMessage: string | null;
  readonly onSave: (name: string, entry: BindingSetEntry) => void;
  readonly onClose: () => void;
}

function sshHostOf(credentials: readonly Credential[], name: string): string {
  const cred = credentials.find((c) => c.name === name);
  if (cred === undefined) return "";
  const rev = newestLiveRevision(cred);
  if (rev === null) return "";
  const meta = rev.metadata;
  if (typeof meta === "object" && meta !== null && !Array.isArray(meta)) {
    const host = (meta as Record<string, unknown>)["host"];
    return typeof host === "string" ? host : "";
  }
  return "";
}

export function BindingSheet({
  projectId,
  target,
  bindingId,
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

  const credentials = useRepositoryCredentials();
  const workerNames = useWorkerNames();
  const workerAgents = useWorkerAgents(draft.kind === "worker" ? draft.worker : "");
  const allCredentials = credentials.data ?? [];
  const sshCredentials = allCredentials.filter((c) => c.platform === "ssh");
  const apiCredentials = allCredentials.filter((c) => c.platform === "github");

  const credentialName = draft.kind === "repository" ? draft.credential : "";
  const bindingCredential = useBindingCredential(
    apiCredentials,
    credentials.reload,
    credentialName,
    (name) => {
      if (draft.kind === "repository") {
        form.edit({ ...draft, credential: name });
      }
    },
  );

  const checkDraft =
    draft.kind === "repository"
      ? draft
      : { platform: "", address: "", sshCredential: "", credential: "", actionName: "" };
  const check = useBindingCheck(projectId, checkDraft, form.validate);

  const [sshImportOpen, setSshImportOpen] = useState(false);

  const onNewSshCredential = useCallback(() => setSshImportOpen(true), []);
  const onSshImported = useCallback(
    (names: readonly string[]) => {
      setSshImportOpen(false);
      credentials.reload();
      if (names.length === 1 && draft.kind === "repository") {
        const name = names[0];
        if (name !== undefined) {
          form.edit({ ...draft, sshCredential: name, sshCredentialHost: "" });
        }
      }
    },
    [credentials, draft, form],
  );

  return (
    <>
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
                    Someone else saved the binding set. The list now shows the new state. Review
                    your change against it, then save again.
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
                  <RepositoryForm
                    projectId={projectId}
                    bindingId={bindingId}
                    saved={target.entry?.kind === "repository" ? target.entry.config : null}
                    draft={draft}
                    errors={errors}
                    sshCredentials={sshCredentials}
                    apiCredentials={apiCredentials}
                    onEdit={(next) => {
                      const host =
                        next.sshCredential !== draft.sshCredential
                          ? sshHostOf(allCredentials, next.sshCredential)
                          : next.sshCredentialHost;
                      form.edit({ ...next, sshCredentialHost: host });
                    }}
                    onNewSshCredential={onNewSshCredential}
                    onNewApiCredential={bindingCredential.openCreate}
                    onRotateApiCredential={bindingCredential.rotate.start}
                    rotateApiCredentialAvailable={bindingCredential.rotate.available}
                  />
                )}
                {draft.kind === "worker" && (
                  <WorkerForm
                    draft={draft}
                    errors={errors}
                    creating={form.creating}
                    workers={workerNames.data ?? []}
                    agents={workerAgents}
                    onEdit={form.edit}
                  />
                )}
                {draft.kind === "storage" && (
                  <StorageForm draft={draft} errors={errors} onEdit={form.edit} />
                )}
              </FieldGroup>
            </div>
            <SheetFooter className="gap-3">
              {form.missingHint !== null && (
                <p className="text-sm text-muted-foreground">{form.missingHint}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {draft.kind === "repository" && (
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={check.checking || !form.checkReady}
                      onClick={check.run}
                    >
                      Verify
                    </Button>
                    <div aria-live="polite" className="flex min-w-0 flex-wrap items-center gap-2">
                      {check.addressBadge !== null && (
                        <Badge variant={check.addressBadge.variant}>
                          Address · {check.addressBadge.label}
                        </Badge>
                      )}
                      {check.sshCredentialBadge !== null && (
                        <Badge variant={check.sshCredentialBadge.variant}>
                          SSH credential · {check.sshCredentialBadge.label}
                        </Badge>
                      )}
                      {check.credentialBadge !== null && (
                        <Badge variant={check.credentialBadge.variant}>
                          Credential · {check.credentialBadge.label}
                        </Badge>
                      )}
                      {check.error !== null && (
                        <span className="text-sm break-words text-destructive">{check.error}</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={saving || !form.saveReady}
                  >
                    Save binding
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      {sshImportOpen && (
        <SshImportDialog open onClose={() => setSshImportOpen(false)} onImported={onSshImported} />
      )}
      {bindingCredential.createOpen && (
        <CredentialCreateSheet
          component="repository"
          open
          onClose={bindingCredential.closeCreate}
          onCreated={bindingCredential.onCreated}
        />
      )}
      {bindingCredential.selectedEntry !== null && (
        <RotateSheet
          name={bindingCredential.selectedCredential.name}
          entry={bindingCredential.selectedEntry}
          rotate={bindingCredential.rotate}
        />
      )}
    </>
  );
}
