import { useState } from "react";

import type { TraceSpan } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Reveal } from "@/components/reveal";
import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isDefaultStandard,
  promptLayerLabel,
  promptPartOrigin,
  promptPartStateLabel,
  promptPartStateNote,
} from "@/lib/prompt-part";

import {
  type AgentPrompt,
  type AgentPromptPart,
  type AgentPromptState,
  type PromptText,
  useAgentPrompt,
} from "../use-agent-prompt";
import type { PromptDiffBase } from "../use-node-traces";
import type { TraceSelection } from "../use-trace-selection";
import { PromptPartDiff } from "./prompt-part-diff";

const UNRESOLVED_TEXT =
  "A part does not resolve, so the server rebuilds no system prompt. The parts below state each cause.";
const SHIPPED_TEXT_HINT =
  "The prompt resolve section of the agent CLI page names the command that reads the old shipped text at this engine version.";

interface PromptRowProps {
  readonly title: string;
  readonly template?: string | null;
  readonly prompt: PromptText;
  readonly onOpen: (entryId: string) => void;
}

function PromptRow({ title, template, prompt, onOpen }: PromptRowProps) {
  const [open, setOpen] = useState(false);
  const { entryId } = prompt;
  return (
    <DataListItem
      title={`${title} ${prompt.length} chars`}
      description={template == null ? undefined : `Template ${template}`}
      actions={
        <>
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={() => setOpen((shown) => !shown)}>
              {open ? "Hide" : "Show"}
            </Button>
          </TouchTarget>
          {entryId !== null && (
            <TouchTarget>
              <Button variant="outline" size="sm" onClick={() => onOpen(entryId)}>
                Open in conversation
              </Button>
            </TouchTarget>
          )}
        </>
      }
      notice={
        <Reveal open={open}>
          <pre className="min-w-0 rounded-md bg-muted p-2 text-xs break-words whitespace-pre-wrap">
            {prompt.text}
          </pre>
        </Reveal>
      }
    />
  );
}

function partFields(part: AgentPromptPart) {
  return [
    { label: "Layer", value: promptLayerLabel(part.layer) },
    { label: "Origin", value: promptPartOrigin(part) },
    ...(part.commit === null
      ? []
      : [{ label: "Commit", value: <span className="font-mono break-all">{part.commit}</span> }]),
    ...(part.path === null
      ? []
      : [{ label: "Path", value: <span className="font-mono break-all">{part.path}</span> }]),
    ...(part.digest === null
      ? []
      : [{ label: "Digest", value: <span className="font-mono break-all">{part.digest}</span> }]),
  ];
}

function partNote(part: AgentPromptPart, engineVersion: string | null): string | undefined {
  const note = promptPartStateNote(part.state);
  if (note === null) return part.heading ?? undefined;
  const shipped =
    part.state === "changed" && part.origin === "binary" && engineVersion !== null
      ? ` Engine version ${engineVersion}. ${SHIPPED_TEXT_HINT}`
      : "";
  return `${note}${shipped}`;
}

interface PartRowProps {
  readonly agent: AgentPrompt;
  readonly part: AgentPromptPart;
}

function PartRow({ agent, part }: PartRowProps) {
  const [shown, setShown] = useState<"text" | "diff" | null>(null);
  const toggle = (view: "text" | "diff") => setShown((current) => (current === view ? null : view));
  const diffExecutionId = part.changed ? agent.diffExecutionId : null;
  return (
    <DataListItem
      title={`${part.part} ${part.name}`}
      status={
        <>
          <Badge variant={part.state === "resolved" ? "secondary" : "destructive"}>
            {promptPartStateLabel(part.state)}
          </Badge>
          {isDefaultStandard(part.layer) && <Badge variant="outline">Default standard</Badge>}
          {part.changed && <Badge variant="outline">Differs from the earlier execution</Badge>}
        </>
      }
      description={partNote(part, agent.engineVersion)}
      fields={partFields(part)}
      actions={
        <>
          {part.text !== null && (
            <TouchTarget>
              <Button variant="outline" size="sm" onClick={() => toggle("text")}>
                {shown === "text" ? "Hide" : "Show"}
              </Button>
            </TouchTarget>
          )}
          {diffExecutionId !== null && (
            <TouchTarget>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={shown === "diff"}
                onClick={() => toggle("diff")}
              >
                Diff
              </Button>
            </TouchTarget>
          )}
        </>
      }
      notice={
        <>
          <Reveal open={shown === "text"}>
            <pre className="min-w-0 rounded-md bg-muted p-2 text-xs break-words whitespace-pre-wrap">
              {part.text}
            </pre>
          </Reveal>
          {diffExecutionId !== null && (
            <Reveal open={shown === "diff"}>
              <PromptPartDiff executionId={diffExecutionId} agentName={agent.name} part={part} />
            </Reveal>
          )}
        </>
      }
    />
  );
}

interface AgentSectionProps {
  readonly agent: AgentPrompt;
  readonly onOpen: (entryId: string) => void;
}

function AgentSection({ agent, onOpen }: AgentSectionProps) {
  return (
    <section aria-label={`Prompt of ${agent.name}`} className="flex min-w-0 flex-col gap-2">
      <h4 className="text-sm font-medium break-all">{agent.name}</h4>
      {agent.error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{agent.error.message}</AlertDescription>
        </Alert>
      )}
      {agent.systemPrompt !== null ? (
        <ItemGroup role="list" aria-label="System prompt" className="gap-2">
          <PromptRow title="System prompt" prompt={agent.systemPrompt} onOpen={onOpen} />
        </ItemGroup>
      ) : (
        agent.error === null && <p className="text-sm text-muted-foreground">{UNRESOLVED_TEXT}</p>
      )}
      {agent.error === null && (
        <DataList
          label={`Prompt parts of ${agent.name}`}
          items={agent.parts}
          getKey={(part) => part.key}
          renderItem={(part) => <PartRow agent={agent} part={part} />}
          status="ready"
          error={null}
          pending={false}
          emptyText="No prompt parts recorded."
        />
      )}
    </section>
  );
}

function Body({ state }: { readonly state: AgentPromptState }) {
  if (!state.recorded)
    return <p className="text-muted-foreground">No prompt record for this trace.</p>;
  if (state.loading)
    return <Skeleton role="status" aria-label="Loading prompt" className="h-24 w-full" />;
  return (
    <>
      {state.error !== null && (
        <Alert variant="destructive" className="flex flex-wrap items-center gap-2">
          <AlertDescription>{state.error.message}</AlertDescription>
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={state.retry}>
              Retry
            </Button>
          </TouchTarget>
        </Alert>
      )}
      {!state.resolvable && (
        <p className="text-muted-foreground">
          This trace names no execution, so the server rebuilds no system prompt.
        </p>
      )}
      {state.agents.map((agent) => (
        <AgentSection key={agent.name} agent={agent} onOpen={state.openInConversation} />
      ))}
      {state.tasks.length > 0 && (
        <ItemGroup role="list" aria-label="Work prompts" className="gap-2">
          {state.tasks.map((task) => (
            <PromptRow
              key={task.taskId}
              title={`Work prompt ${task.taskId}`}
              template={task.template}
              prompt={task.prompt}
              onOpen={state.openInConversation}
            />
          ))}
        </ItemGroup>
      )}
    </>
  );
}

interface PromptBlockProps {
  readonly traceId: string;
  readonly executionId: string | null;
  readonly spans: readonly TraceSpan[];
  readonly selection: TraceSelection;
  readonly diffBase: PromptDiffBase | null;
}

export function PromptBlock({
  traceId,
  executionId,
  spans,
  selection,
  diffBase,
}: PromptBlockProps) {
  const state = useAgentPrompt(traceId, executionId, spans, selection, diffBase);
  return (
    <section aria-label="What the agent received" className="flex min-w-0 flex-col gap-3">
      <h3 className="text-base font-semibold">What the agent received</h3>
      <Body state={state} />
    </section>
  );
}
