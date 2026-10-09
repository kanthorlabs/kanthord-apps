import { Link } from "react-router-dom";

import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { REASONING_EFFORTS, type AgentEntryDraft, type DraftErrors } from "@/lib/binding-draft";
import type { WorkerAgent } from "../use-worker-agents";
import { DraftField } from "./draft-field";

const DEFAULT_VALUE = "default";

const EFFORTS = [
  { value: DEFAULT_VALUE, label: "Agent default" },
  ...REASONING_EFFORTS.map((effort) => ({ value: effort, label: effort })),
];

const STATE_LABELS = { enabled: "Enabled", disabled: "Disabled", absent: "Not enabled" } as const;

interface WorkerAgentItemProps {
  readonly agentName: string;
  readonly agent: WorkerAgent | null;
  readonly entry: AgentEntryDraft | null;
  readonly index: number | null;
  readonly errors: DraftErrors;
  readonly onCustom: (custom: boolean) => void;
  readonly onEdit: (entry: AgentEntryDraft) => void;
}

export function WorkerAgentItem({
  agentName,
  agent,
  entry,
  index,
  errors,
  onCustom,
  onEdit,
}: WorkerAgentItemProps) {
  const id = `binding-agent-${agentName}`;
  const providers = [
    { value: DEFAULT_VALUE, label: "Agent default" },
    ...(agent?.providers ?? []).map((provider) => ({
      value: provider.name,
      label: `${provider.name} (${provider.provider})`,
    })),
  ];
  const defaults = agent?.defaults ?? null;

  return (
    <Item variant="outline" role="listitem" className="items-start">
      <ItemContent className="min-w-0 gap-3">
        <ItemTitle className="flex-wrap">
          <span className="font-mono">{agentName}</span>
          {agent !== null && (
            <Badge variant={agent.state === "enabled" ? "secondary" : "destructive"}>
              {STATE_LABELS[agent.state]}
            </Badge>
          )}
        </ItemTitle>
        <ItemDescription>
          {defaults === null
            ? "No default configuration."
            : `Default: ${defaults.agent_provider} · ${defaults.model_identifier} · ${defaults.reasoning_effort}`}
        </ItemDescription>
        {agent === null && (
          <p className="text-sm text-destructive">
            This worker does not declare this agent. Turn off the custom configuration to remove the
            entry.
          </p>
        )}
        {agent !== null && agent.state !== "enabled" && (
          <p className="text-sm text-destructive">
            Enable this agent on its{" "}
            <Link to={`/agents/${encodeURIComponent(agentName)}`}>agent page</Link> before you save.
            The server refuses a worker binding with an agent that is not enabled.
          </p>
        )}
        <Field orientation="horizontal">
          <Switch id={`${id}-custom`} checked={entry !== null} onCheckedChange={onCustom} />
          <FieldLabel htmlFor={`${id}-custom`}>Custom configuration</FieldLabel>
        </Field>
        <Reveal open={entry !== null}>
          {entry !== null && index !== null && (
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor={`${id}-provider`}>Agent provider</FieldLabel>
                <Select
                  items={providers}
                  value={entry.agentProvider === "" ? DEFAULT_VALUE : entry.agentProvider}
                  onValueChange={(value) =>
                    onEdit({
                      ...entry,
                      agentProvider: value === null || value === DEFAULT_VALUE ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id={`${id}-provider`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <DraftField
                id={`${id}-model`}
                label="Model identifier"
                value={entry.modelIdentifier}
                error={errors[`entries.${index}.modelIdentifier`]}
                description={
                  entry.agentProvider === ""
                    ? "Optional. Empty keeps the default model."
                    : "Required with a custom agent provider."
                }
                onChange={(modelIdentifier) => onEdit({ ...entry, modelIdentifier })}
              />
              <Field data-invalid={errors[`entries.${index}.reasoningEffort`] !== undefined}>
                <FieldLabel htmlFor={`${id}-effort`}>Reasoning effort</FieldLabel>
                <Select
                  items={EFFORTS}
                  value={entry.reasoningEffort === "" ? DEFAULT_VALUE : entry.reasoningEffort}
                  onValueChange={(value) =>
                    onEdit({
                      ...entry,
                      reasoningEffort: value === null || value === DEFAULT_VALUE ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id={`${id}-effort`} className="w-full">
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
                <FieldError>{errors[`entries.${index}.reasoningEffort`]}</FieldError>
              </Field>
            </div>
          )}
        </Reveal>
      </ItemContent>
    </Item>
  );
}
