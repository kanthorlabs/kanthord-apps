import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { AgentSummary, AgentVariantItem } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemHeader, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { variantPath } from "@/lib/agent-variant";
import { enablementLabel, enablementVariant } from "@/lib/agent-enablement";
import { agentLabel } from "@/lib/agent-label";
import { toolCountsLine } from "@/lib/agent-tools";
import { newSessionPath } from "@/lib/workbench-new-session";
import { newSessionUnavailableReason } from "@/lib/workbench-sessions";
import { NewSessionButton } from "@/features/workbench/sessions/components/new-session-button";
import { NewSessionDialog } from "@/features/workbench/sessions/components/new-session-dialog";
import { ENABLEMENT_HASH } from "../agent/use-enablement-create";
import { useAgents } from "./use-agents";
import { useAgentVariants } from "./use-agent-variants";
import { VariantCreateDialog } from "./variant-create-dialog";

interface AgentItemProps {
  readonly agent: AgentSummary;
  readonly variants: readonly AgentVariantItem[];
}

function AgentItem({ agent, variants }: AgentItemProps) {
  const { agentName, workerNames, toolCounts, enablement, consumers } = agent;
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [creating, setCreating] = useState(false);
  const sessionAgent = consumers.includes("workbench");

  return (
    <Item variant="outline" role="listitem">
      <ItemHeader className="flex-wrap">
        <ItemTitle>
          <Link
            to={`/agents/${encodeURIComponent(agentName)}`}
            className="underline-offset-4 hover:underline"
          >
            {agentLabel(agent)}
          </Link>
        </ItemTitle>
        <Badge variant={enablementVariant(enablement)}>{enablementLabel(enablement)}</Badge>
        {enablement === null && (
          <Button
            size="sm"
            nativeButton={false}
            aria-label={`Enable ${agentName}`}
            render={<Link to={`/agents/${encodeURIComponent(agentName)}${ENABLEMENT_HASH}`} />}
          >
            Enable
          </Button>
        )}
        {sessionAgent && (
          <NewSessionButton
            size="sm"
            label={`New session with ${agentName}`}
            unavailableReason={newSessionUnavailableReason(enablement?.state ?? null)}
            onStart={() => setStarting(true)}
          />
        )}
      </ItemHeader>
      {starting && (
        <NewSessionDialog
          agents={[agent]}
          initialAgentName={agentName}
          onClose={() => setStarting(false)}
          onStart={(agentName, configuration, agentDisplayName) =>
            navigate(newSessionPath(agentName, configuration, agentDisplayName))
          }
        />
      )}
      {creating && (
        <VariantCreateDialog
          agentName={agentName}
          onClose={() => setCreating(false)}
          onCreated={(variant) => navigate(variantPath(variant.agent_name, variant.id))}
        />
      )}
      <ItemContent className="min-w-0 gap-3">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Workers</dt>
          <dd className="font-mono break-all">{workerNames.join(", ")}</dd>
          <dt className="text-muted-foreground">Tools</dt>
          <dd>{toolCountsLine(toolCounts)}</dd>
          {enablement !== null && (
            <>
              <dt className="text-muted-foreground">Agent providers</dt>
              <dd className="font-mono break-all">
                {enablement.agent_providers.map((p) => p.name).join(", ")}
              </dd>
              <dt className="text-muted-foreground">Default</dt>
              <dd className="font-mono break-all">
                {enablement.default_configuration.agent_provider} ·{" "}
                {enablement.default_configuration.model_identifier} ·{" "}
                {enablement.default_configuration.reasoning_effort}
              </dd>
            </>
          )}
        </dl>
        {sessionAgent && (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Variants</span>
              <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                New variant
              </Button>
            </div>
            {variants.length > 0 && (
              <ItemGroup aria-label={`Variants of ${agentName}`} className="gap-2">
                {variants.map((variant) => (
                  <Item key={variant.id} variant="muted" size="sm" role="listitem">
                    <ItemTitle>
                      <Link
                        to={variantPath(agentName, variant.id)}
                        className="underline-offset-4 hover:underline"
                      >
                        {variant.display_name} (v{variant.revision})
                      </Link>
                    </ItemTitle>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </div>
        )}
      </ItemContent>
    </Item>
  );
}

export function AgentsScreen() {
  const agentsRead = useAgents();
  const variantsRead = useAgentVariants();
  const agents = agentsRead.data;
  const variants = variantsRead.data ?? [];
  const error = agentsRead.error ?? variantsRead.error;
  const loading = agentsRead.loading || variantsRead.loading;
  const { reload: reloadAgents } = agentsRead;
  const { reload: reloadVariants } = variantsRead;
  const reload = () => {
    reloadAgents();
    reloadVariants();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">{error.message}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  if (agents === null || agents.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No agents in the catalog.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup aria-label="Agents" className="gap-4">
      {agents.map((agent) => (
        <AgentItem
          key={agent.agentName}
          agent={agent}
          variants={variants.filter((variant) => variant.agent_name === agent.agentName)}
        />
      ))}
    </ItemGroup>
  );
}
