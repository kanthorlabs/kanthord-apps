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
import type { BindingSetEntry, EnvironmentState, RepositoryBindingConfig } from "@/api/types";
import { CredentialCreateSheet } from "@/features/credentials/components/credential-create-sheet";
import { RotateSheet } from "@/features/credentials/components/rotate-sheet";
import { SshKeyFacts } from "@/features/credentials/components/ssh-key-facts";
import { SshKeySheet } from "@/features/credentials/components/ssh-key-sheet";
import { EnablementSheet } from "@/features/workers/agent/components/enablement-sheet";
import { pinnableHostOf } from "@/lib/binding-draft";
import { isArchived } from "@/lib/credential-revisions";
import { SSH_PLATFORM, sshKeyNamed } from "@/lib/ssh-key";
import { useBindingCredential } from "../use-binding-credential";
import { useBindingCheck } from "../use-binding-check";
import { type BindingTarget, useBindingDraft } from "../use-binding-draft";
import { useHostKeyPin } from "../use-host-key-pin";
import { usePlacementDefault } from "../use-placement-default";
import { useRepositoryCredentials } from "../use-repository-credentials";
import { useWorkerAgents } from "../use-worker-agents";
import { useWorkerInstanceForm } from "../use-worker-instance-form";
import { useWorkerNames } from "../use-worker-names";
import { DraftField } from "./draft-field";
import { EnvironmentSection } from "./environment-section";
import { HostKeyPin } from "./host-key-pin";
import { InstanceAddSheet } from "./instance-add-sheet";
import { RepositoryForm } from "./repository-form";
import { StorageForm } from "./storage-form";
import { WorkerForm } from "./worker-form";

const KIND_LABELS = { repository: "repository", worker: "worker", storage: "storage" } as const;

interface BindingSheetProps {
  readonly projectId: string;
  readonly target: BindingTarget;
  readonly bindingId: string | null;
  readonly environment: EnvironmentState | null;
  readonly takenNames: readonly string[];
  readonly repositoryNames: readonly string[];
  readonly saving: boolean;
  readonly conflict: boolean;
  readonly errorMessage: string | null;
  readonly instancesError: string | null;
  readonly onSave: (name: string, entry: BindingSetEntry) => void;
  readonly onEnvironmentChanged: () => void;
  readonly onEnvironmentWritten: (
    patch: Pick<RepositoryBindingConfig, "environment" | "environment_secrets">,
  ) => void;
  readonly onClose: () => void;
}

export function BindingSheet({
  projectId,
  target,
  bindingId,
  environment,
  takenNames,
  repositoryNames,
  saving,
  conflict,
  errorMessage,
  instancesError,
  onSave,
  onEnvironmentChanged,
  onEnvironmentWritten,
  onClose,
}: BindingSheetProps) {
  const form = useBindingDraft(target, takenNames);
  const { draft } = form;
  const errors =
    instancesError === null ? form.errors : { ...form.errors, instances: instancesError };
  const kindLabel = KIND_LABELS[target.kind];

  const credentials = useRepositoryCredentials();
  const workerNames = useWorkerNames();
  const workerAgents = useWorkerAgents(draft.kind === "worker" ? draft.worker : "");
  const placementDefault = usePlacementDefault(form, workerAgents);
  const workerInstances = useWorkerInstanceForm(projectId, form, target, repositoryNames);
  const [enablingAgent, setEnablingAgent] = useState<string | null>(null);
  const allCredentials = credentials.data ?? [];
  const sshCredentials = allCredentials.filter(
    (c) => c.platform === SSH_PLATFORM && !isArchived(c),
  );
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
  const hostKeyPin = useHostKeyPin(draft.kind === "repository" ? pinnableHostOf(draft) : null);
  const refusedKey =
    draft.kind === "repository" && check.keyRefused
      ? sshKeyNamed(sshCredentials, draft.sshCredential)
      : null;

  const [sshKeyOpen, setSshKeyOpen] = useState(false);

  const onNewSshCredential = useCallback(() => setSshKeyOpen(true), []);
  const onSshKeyCreated = useCallback(
    (name: string) => {
      setSshKeyOpen(false);
      credentials.reload();
      if (draft.kind === "repository") {
        form.edit({ ...draft, sshCredential: name });
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
              const entry = workerInstances.validate();
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
                      ? draft.kind === "worker"
                        ? "Unique in the project. Machine tokens name the binding by it."
                        : "Unique in the project. Mission nodes name the binding by it."
                      : "A new name removes the binding and adds another one, so the name is fixed here."
                  }
                  onChange={(name) => form.edit({ ...draft, name })}
                />
                {draft.kind === "repository" && (
                  <RepositoryForm
                    draft={draft}
                    errors={errors}
                    sshCredentials={sshCredentials}
                    apiCredentials={apiCredentials}
                    hostKey={<HostKeyPin pin={hostKeyPin} />}
                    onEdit={form.edit}
                    onNewSshCredential={onNewSshCredential}
                    onNewApiCredential={bindingCredential.openCreate}
                    onRotateApiCredential={bindingCredential.rotate.start}
                    rotateApiCredentialAvailable={bindingCredential.rotate.available}
                  />
                )}
                {draft.kind === "repository" && !form.creating && bindingId !== null && (
                  <EnvironmentSection
                    projectId={projectId}
                    bindingId={bindingId}
                    bindingName={draft.name}
                    state={environment}
                    action={
                      target.entry?.kind === "repository"
                        ? target.entry.config.strategy.action
                        : undefined
                    }
                    secrets={
                      target.entry?.kind === "repository"
                        ? (target.entry.config.environment_secrets ?? {})
                        : {}
                    }
                    focused={target.section === "environment"}
                    onChanged={onEnvironmentChanged}
                    onWritten={onEnvironmentWritten}
                  />
                )}
                {draft.kind === "worker" && (
                  <WorkerForm
                    projectId={projectId}
                    draft={draft}
                    errors={errors}
                    creating={form.creating}
                    repositoryNames={repositoryNames}
                    workers={workerNames.data ?? []}
                    agents={workerAgents}
                    instances={workerInstances}
                    onEdit={workerInstances.edit}
                    onEnableAgent={setEnablingAgent}
                  />
                )}
                {draft.kind === "storage" && (
                  <StorageForm draft={draft} errors={errors} onEdit={form.edit} />
                )}
              </FieldGroup>
            </div>
            <SheetFooter className="gap-3">
              {(form.missingHint ?? placementDefault.reason) !== null && (
                <p className="text-sm text-muted-foreground">
                  {form.missingHint ?? placementDefault.reason}
                </p>
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
                      {check.addressHint !== null && (
                        <p className="basis-full text-sm break-words">{check.addressHint}</p>
                      )}
                      {check.sshCredentialHint !== null && (
                        <p className="basis-full text-sm break-words">{check.sshCredentialHint}</p>
                      )}
                      {refusedKey !== null && (
                        <div className="min-w-0 basis-full">
                          <SshKeyFacts sshKey={refusedKey} />
                        </div>
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
                    disabled={
                      saving || !form.saveReady || placementDefault.waiting || !hostKeyPin.ready
                    }
                  >
                    Save binding
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      {draft.kind === "worker" && (
        <InstanceAddSheet projectId={projectId} worker={draft.worker} add={workerInstances.add} />
      )}
      {enablingAgent !== null && (
        <EnablementSheet
          agentName={enablingAgent}
          reload={workerAgents.reload}
          onClose={() => setEnablingAgent(null)}
        />
      )}
      {sshKeyOpen && <SshKeySheet onClose={() => setSshKeyOpen(false)} onDone={onSshKeyCreated} />}
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
