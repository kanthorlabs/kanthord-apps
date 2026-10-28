import type { ReactNode } from "react";

import type { Credential, RepositoryActionName, RepositoryPlatform } from "@/api/types";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addressRuleOf,
  type DraftErrors,
  type RepositoryDraft,
  withPlatform,
} from "@/lib/binding-draft";
import { AvailabilityField } from "./availability-field";
import { BindingPromptsFieldset } from "./binding-prompts-fieldset";
import { CredentialCombobox } from "./credential-combobox";
import { DraftField } from "./draft-field";

const NO_ACTION = "none";

const ALL_ACTIONS = [
  { value: NO_ACTION, label: "No external action" },
  { value: "pull_request", label: "Open a pull request" },
  { value: "merge_push", label: "Merge and push" },
] as const;

const SSH_CREDENTIAL_HINT =
  "The SSH key that git uses to clone, fetch and push this repository. Every binding needs it.";

const GITHUB_CREDENTIAL_HINT =
  "The GitHub API token that opens a pull request. Git over SSH cannot call the GitHub API, so a pull request needs this second credential.";

const GIT_ONLY_ACTIONS = ALL_ACTIONS.filter((a) => a.value !== "pull_request");

const PLATFORMS: readonly { readonly value: RepositoryPlatform; readonly label: string }[] = [
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "bitbucket", label: "Bitbucket" },
];

interface RepositoryFormProps {
  readonly draft: RepositoryDraft;
  readonly errors: DraftErrors;
  readonly sshCredentials: readonly Credential[];
  readonly apiCredentials: readonly Credential[];
  readonly hostKey: ReactNode;
  readonly onEdit: (draft: RepositoryDraft) => void;
  readonly onNewSshCredential: () => void;
  readonly onNewApiCredential: () => void;
  readonly onRotateApiCredential: () => void;
  readonly rotateApiCredentialAvailable: boolean;
}

export function RepositoryForm({
  draft,
  errors,
  sshCredentials,
  apiCredentials,
  hostKey,
  onEdit,
  onNewSshCredential,
  onNewApiCredential,
  onRotateApiCredential,
  rotateApiCredentialAvailable,
}: RepositoryFormProps) {
  const actions = draft.platform === "github" ? ALL_ACTIONS : GIT_ONLY_ACTIONS;

  return (
    <>
      <AvailabilityField
        id="binding-available"
        available={draft.available}
        onChange={(available) => onEdit({ ...draft, available })}
      />
      <FieldSet>
        <FieldLegend>Repository</FieldLegend>
        <Field>
          <FieldLabel htmlFor="binding-platform">Platform</FieldLabel>
          <Select
            items={PLATFORMS}
            value={draft.platform}
            onValueChange={(value) => {
              if (value !== null) onEdit(withPlatform(draft, value as RepositoryPlatform));
            }}
          >
            <SelectTrigger id="binding-platform" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DraftField
          id="binding-address"
          label="Address"
          value={draft.address}
          error={errors["address"]}
          description={addressRuleOf(draft.platform)}
          onChange={(address) => onEdit({ ...draft, address })}
        />
        {hostKey}
        <CredentialCombobox
          id="binding-ssh-credential"
          label="SSH credential"
          hint={SSH_CREDENTIAL_HINT}
          credentials={sshCredentials}
          value={draft.sshCredential}
          error={errors["sshCredential"]}
          onChange={(sshCredential) => onEdit({ ...draft, sshCredential })}
          onNew={onNewSshCredential}
          newLabel="New SSH credential"
        />
        {draft.platform === "github" && (
          <CredentialCombobox
            id="binding-credential"
            label="GitHub credential"
            hint={GITHUB_CREDENTIAL_HINT}
            credentials={apiCredentials}
            value={draft.credential}
            error={errors["credential"]}
            description={
              draft.actionName === "pull_request"
                ? undefined
                : "Optional. Required when the action is Open a pull request."
            }
            onChange={(credential) => onEdit({ ...draft, credential })}
            onNew={onNewApiCredential}
            onRotate={onRotateApiCredential}
            rotateAvailable={rotateApiCredentialAvailable}
          />
        )}
      </FieldSet>
      <FieldSet>
        <FieldLegend>Project policy</FieldLegend>
        <DraftField
          id="binding-base-branch"
          label="Base branch"
          value={draft.baseBranch}
          error={errors["baseBranch"]}
          onChange={(baseBranch) => onEdit({ ...draft, baseBranch })}
        />
        <Field>
          <FieldLabel htmlFor="binding-action">External action</FieldLabel>
          <Select
            items={actions}
            value={draft.actionName === "" ? NO_ACTION : draft.actionName}
            onValueChange={(value) =>
              onEdit({
                ...draft,
                actionName:
                  value === null || value === NO_ACTION ? "" : (value as RepositoryActionName),
              })
            }
          >
            <SelectTrigger id="binding-action" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {actions.map((action) => (
                <SelectItem key={action.value} value={action.value}>
                  {action.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>The action follows a passing assessment.</FieldDescription>
        </Field>
      </FieldSet>
      <BindingPromptsFieldset draft={draft} onEdit={onEdit} />
    </>
  );
}
