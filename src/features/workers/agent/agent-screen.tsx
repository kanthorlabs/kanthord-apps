import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { AgentEnablement, AgentTool } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { workbenchListPath } from "@/lib/workbench-sessions";
import { enablementLabel, enablementVariant } from "@/lib/agent-enablement";
import { providerRemovalBlock } from "@/lib/agent-provider-draft";
import { AgentProviderRemoveDialog } from "./components/agent-provider-remove-dialog";
import { AgentProviderSheet } from "./components/agent-provider-sheet";
import { DefaultConfigurationSheet } from "./components/default-configuration-sheet";
import { EnablementForm } from "./components/enablement-form";
import { EnablementSwitch } from "./components/enablement-switch";
import { RemoveProviderButton } from "./components/remove-provider-button";
import { useAgent } from "./use-agent";
import { useAgentProviderAdd } from "./use-agent-provider-add";
import { useAgentProviderRemove } from "./use-agent-provider-remove";

interface EnablementSectionProps {
  readonly agentName: string;
  readonly enablement: AgentEnablement | null;
  readonly reload: () => void;
}

function AddAgentProvider({
  agentName,
  enablement,
  reload,
}: {
  readonly agentName: string;
  readonly enablement: AgentEnablement;
  readonly reload: () => void;
}) {
  const add = useAgentProviderAdd(agentName, enablement, reload);
  return (
    <>
      <Button variant="outline" size="sm" onClick={add.start}>
        <PlusIcon aria-hidden="true" data-icon="inline-start" />
        Add agent provider
      </Button>
      <AgentProviderSheet agentName={agentName} revision={enablement.revision} add={add} />
    </>
  );
}

function EditDefault({
  agentName,
  enablement,
  reload,
}: {
  readonly agentName: string;
  readonly enablement: AgentEnablement;
  readonly reload: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilIcon aria-hidden="true" data-icon="inline-start" />
        Edit default
      </Button>
      <DefaultConfigurationSheet
        agentName={agentName}
        enablement={enablement}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          reload();
        }}
      />
    </>
  );
}

function AgentProviderList({
  agentName,
  enablement,
  reload,
}: {
  readonly agentName: string;
  readonly enablement: AgentEnablement;
  readonly reload: () => void;
}) {
  const remove = useAgentProviderRemove(agentName, enablement, reload);
  return (
    <>
      <ItemGroup aria-label="Agent providers" className="gap-2">
        {enablement.agentProviders.map((p) => (
          <Item key={p.name} variant="outline" size="sm" role="listitem">
            <ItemContent className="min-w-0">
              <ItemTitle>
                <span className="font-mono">{p.name}</span>
              </ItemTitle>
              <p className="text-sm break-all text-muted-foreground">
                {p.provider} · credential {p.credential}
              </p>
            </ItemContent>
            <ItemActions>
              <RemoveProviderButton
                providerName={p.name}
                blockedReason={providerRemovalBlock(enablement, p.name)}
                onRemove={() => remove.request(p.name)}
              />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      <AgentProviderRemoveDialog agentName={agentName} remove={remove} />
    </>
  );
}

function EnablementSection({ agentName, enablement, reload }: EnablementSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold leading-none">Enablement</h2>
        {enablement !== null && (
          <div className="flex flex-wrap gap-2">
            <EditDefault agentName={agentName} enablement={enablement} reload={reload} />
            <AddAgentProvider agentName={agentName} enablement={enablement} reload={reload} />
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {enablement === null ? (
          <>
            <p className="text-sm text-muted-foreground">
              No enablement exists. A human enables the agent before a worker binding can use it.
            </p>
            <EnablementForm agentName={agentName} reload={reload} />
          </>
        ) : (
          <>
            <EnablementSwitch enablement={enablement} reload={reload} />
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Revision</dt>
              <dd className="tabular-nums">{enablement.revision}</dd>
              <dt className="text-muted-foreground">Default agent provider</dt>
              <dd className="font-mono break-all">
                {enablement.defaultConfiguration.agentProvider}
              </dd>
              <dt className="text-muted-foreground">Default model</dt>
              <dd className="font-mono break-all">
                {enablement.defaultConfiguration.modelIdentifier}
              </dd>
              <dt className="text-muted-foreground">Default reasoning effort</dt>
              <dd className="font-mono">{enablement.defaultConfiguration.reasoningEffort}</dd>
            </dl>
            <AgentProviderList agentName={agentName} enablement={enablement} reload={reload} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ToolsSection({ tools }: { tools: readonly AgentTool[] }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold leading-none">Tools</h2>
      </CardHeader>
      <CardContent>
        <ItemGroup aria-label="Tools" className="gap-2">
          {tools.map((tool) => (
            <Item key={tool.name} variant="outline" size="sm" role="listitem">
              <ItemContent className="min-w-0">
                <ItemTitle>
                  <span className="font-mono">{tool.name}</span>
                </ItemTitle>
              </ItemContent>
              <Badge variant="outline">{tool.source}</Badge>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function PromptSection({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold leading-none">{title}</h2>
      </CardHeader>
      <CardContent>
        <pre className="font-mono text-xs break-words whitespace-pre-wrap">{text}</pre>
      </CardContent>
    </Card>
  );
}

export function AgentScreen() {
  const { agentName = "" } = useParams<{ agentName: string }>();
  const { data: agent, error, loading, reload } = useAgent(agentName);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error !== null || agent === null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">{error?.message}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-lg font-semibold">{agent.agentName}</h2>
        <Badge variant={enablementVariant(agent.enablement)}>
          {enablementLabel(agent.enablement)}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to={workbenchListPath(agent.agentName)} />}
        >
          Workbench
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <span className="text-muted-foreground">Overridable in a worker binding:</span>
        {agent.overridableFields.map((field) => (
          <Badge key={field} variant="outline">
            {field}
          </Badge>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <EnablementSection
          agentName={agent.agentName}
          enablement={agent.enablement}
          reload={reload}
        />
        <ToolsSection tools={agent.tools} />
      </div>
      <PromptSection title="Agent prompt" text={agent.agentPrompt} />
      {agent.basePrompt !== undefined && (
        <PromptSection title="Base prompt" text={agent.basePrompt} />
      )}
    </div>
  );
}
