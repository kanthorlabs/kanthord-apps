import type { RepositoryActionName } from "@/api/types";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DraftErrors, RepositoryDraft } from "@/lib/binding-draft";
import { AvailabilityField } from "./availability-field";
import { DraftField } from "./draft-field";

const NO_ACTION = "none";

const ACTIONS = [
  { value: NO_ACTION, label: "No external action" },
  { value: "pull_request", label: "Open a pull request" },
  { value: "merge_push", label: "Merge and push" },
] as const;

interface RepositoryFormProps {
  readonly draft: RepositoryDraft;
  readonly errors: DraftErrors;
  readonly onEdit: (draft: RepositoryDraft) => void;
}

export function RepositoryForm({ draft, errors, onEdit }: RepositoryFormProps) {
  return (
    <>
      <AvailabilityField
        id="binding-available"
        available={draft.available}
        onChange={(available) => onEdit({ ...draft, available })}
      />
      <DraftField
        id="binding-address"
        label="Address"
        value={draft.address}
        error={errors["address"]}
        description="A GitHub SSH address. A new address replaces the binding."
        onChange={(address) => onEdit({ ...draft, address })}
      />
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
          items={ACTIONS}
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
            {ACTIONS.map((action) => (
              <SelectItem key={action.value} value={action.value}>
                {action.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>The action follows a passing assessment.</FieldDescription>
      </Field>
      <DraftField
        id="binding-credential"
        label="Credential"
        value={draft.credential}
        error={errors["credential"]}
        onChange={(credential) => onEdit({ ...draft, credential })}
      />
      <Field>
        <FieldLabel htmlFor="binding-project-prompt">Project prompt</FieldLabel>
        <Textarea
          id="binding-project-prompt"
          value={draft.projectPrompt}
          onChange={(event) => onEdit({ ...draft, projectPrompt: event.target.value })}
        />
        <FieldDescription>Optional. Every native agent of this project reads it.</FieldDescription>
      </Field>
    </>
  );
}
