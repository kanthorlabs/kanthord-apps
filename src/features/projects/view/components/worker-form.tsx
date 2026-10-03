import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Item, ItemActions, ItemContent, ItemGroup } from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REASONING_EFFORTS,
  type AgentEntryDraft,
  type DraftErrors,
  type WorkerDraft,
} from "@/lib/binding-draft";
import { DraftField } from "./draft-field";

const DEFAULT_EFFORT = "default";

const EFFORTS = [
  { value: DEFAULT_EFFORT, label: "Agent default" },
  ...REASONING_EFFORTS.map((effort) => ({ value: effort, label: effort })),
];

const EMPTY_ENTRY: AgentEntryDraft = {
  agent: "",
  agentProvider: "",
  modelIdentifier: "",
  reasoningEffort: "",
};

interface WorkerFormProps {
  readonly draft: WorkerDraft;
  readonly errors: DraftErrors;
  readonly creating: boolean;
  readonly onEdit: (draft: WorkerDraft) => void;
}

export function WorkerForm({ draft, errors, creating, onEdit }: WorkerFormProps) {
  const editEntry = (index: number, entry: AgentEntryDraft) =>
    onEdit({
      ...draft,
      entries: draft.entries.map((current, position) => (position === index ? entry : current)),
    });

  return (
    <>
      <DraftField
        id="binding-worker"
        label="Worker"
        value={draft.worker}
        error={errors["worker"]}
        readOnly={!creating}
        description={
          creating
            ? "The catalog name, for example general@1."
            : "A worker binding keeps its worker. Remove the binding and add another to change it."
        }
        onChange={(worker) => onEdit({ ...draft, worker })}
      />
      <DraftField
        id="binding-instance-count"
        label="Instance count"
        value={draft.instanceCount}
        error={errors["instanceCount"]}
        inputMode="numeric"
        description="0 makes the binding unavailable."
        onChange={(instanceCount) => onEdit({ ...draft, instanceCount })}
      />
      <DraftField
        id="binding-turns"
        label="Turn budget"
        value={draft.turns}
        error={errors["turns"]}
        inputMode="numeric"
        description="Optional. Give both budget values or neither."
        onChange={(turns) => onEdit({ ...draft, turns })}
      />
      <DraftField
        id="binding-wall-time"
        label="Wall-time budget (ms)"
        value={draft.wallTimeMs}
        error={errors["wallTimeMs"]}
        inputMode="numeric"
        onChange={(wallTimeMs) => onEdit({ ...draft, wallTimeMs })}
      />
      <section aria-label="Agent entries" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium">Agent entries</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit({ ...draft, entries: [...draft.entries, EMPTY_ENTRY] })}
          >
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            Add entry
          </Button>
        </div>
        {draft.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No entry. Each agent uses its global default configuration.
          </p>
        ) : (
          <ItemGroup aria-label="Agent entries" className="gap-2">
            {draft.entries.map((entry, index) => (
              <Item key={index} variant="outline" role="listitem" className="items-start">
                <ItemContent className="min-w-0 gap-3">
                  <DraftField
                    id={`binding-entry-${index}-agent`}
                    label="Agent"
                    value={entry.agent}
                    error={errors[`entries.${index}.agent`]}
                    onChange={(agent) => editEntry(index, { ...entry, agent })}
                  />
                  <DraftField
                    id={`binding-entry-${index}-provider`}
                    label="Agent provider"
                    value={entry.agentProvider}
                    error={undefined}
                    description="Optional."
                    onChange={(agentProvider) => editEntry(index, { ...entry, agentProvider })}
                  />
                  <DraftField
                    id={`binding-entry-${index}-model`}
                    label="Model identifier"
                    value={entry.modelIdentifier}
                    error={undefined}
                    description="Optional."
                    onChange={(modelIdentifier) => editEntry(index, { ...entry, modelIdentifier })}
                  />
                  <Field>
                    <FieldLabel htmlFor={`binding-entry-${index}-effort`}>
                      Reasoning effort
                    </FieldLabel>
                    <Select
                      items={EFFORTS}
                      value={entry.reasoningEffort === "" ? DEFAULT_EFFORT : entry.reasoningEffort}
                      onValueChange={(value) =>
                        editEntry(index, {
                          ...entry,
                          reasoningEffort: value === null || value === DEFAULT_EFFORT ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger id={`binding-entry-${index}-effort`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EFFORTS.map((effort) => (
                          <SelectItem key={effort.value} value={effort.value}>
                            {effort.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove entry ${index + 1}`}
                    onClick={() =>
                      onEdit({
                        ...draft,
                        entries: draft.entries.filter((_, position) => position !== index),
                      })
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>
    </>
  );
}
