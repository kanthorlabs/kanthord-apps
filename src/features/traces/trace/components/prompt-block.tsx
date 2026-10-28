import { useState } from "react";

import type { TraceSpan } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Reveal } from "@/components/reveal";
import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";

import {
  type AgentPrompt,
  type AgentPromptState,
  type PromptText,
  useAgentPrompt,
} from "../use-agent-prompt";
import type { TraceSelection } from "../use-trace-selection";

interface PromptRowProps {
  readonly title: string;
  readonly template?: string | null;
  readonly prompt: PromptText;
  readonly onOpen: (entryId: string) => void;
}

function PromptRow({ title, template, prompt, onOpen }: PromptRowProps) {
  const [open, setOpen] = useState(false);
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
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={() => onOpen(prompt.entryId)}>
              Open in conversation
            </Button>
          </TouchTarget>
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

interface AgentSectionProps {
  readonly agent: AgentPrompt;
  readonly onOpen: (entryId: string) => void;
}

function AgentSection({ agent, onOpen }: AgentSectionProps) {
  return (
    <section aria-label={`Prompt of ${agent.name}`} className="flex min-w-0 flex-col gap-2">
      <h4 className="text-sm font-medium break-all">{agent.name}</h4>
      {agent.systemPrompt !== null && (
        <ItemGroup role="list" aria-label="System prompt" className="gap-2">
          <PromptRow title="System prompt" prompt={agent.systemPrompt} onOpen={onOpen} />
        </ItemGroup>
      )}
      <DataList
        label={`Prompt layers of ${agent.name}`}
        items={agent.parts}
        getKey={(part) => `${part.part}:${part.name}`}
        renderItem={(part) => <DataListItem title={`${part.part} ${part.name}`} />}
        status="ready"
        error={null}
        pending={false}
        emptyText="No prompt layers recorded."
      />
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
  readonly spans: readonly TraceSpan[];
  readonly selection: TraceSelection;
}

export function PromptBlock({ traceId, spans, selection }: PromptBlockProps) {
  const state = useAgentPrompt(traceId, spans, selection);
  return (
    <section aria-label="What the agent received" className="flex min-w-0 flex-col gap-3">
      <h3 className="text-base font-semibold">What the agent received</h3>
      <Body state={state} />
    </section>
  );
}
