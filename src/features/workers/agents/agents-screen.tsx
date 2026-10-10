import { Fragment, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { AgentSummary } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemHeader, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { enablementLabel, enablementVariant } from "@/lib/agent-enablement";
import { newSessionUnavailableReason, workbenchSessionPath } from "@/lib/workbench-sessions";
import { NewSessionButton } from "@/features/workbench/sessions/components/new-session-button";
import { NewSessionDialog } from "@/features/workbench/sessions/components/new-session-dialog";
import { useAgents } from "./use-agents";

function AgentItem({ agent }: { agent: AgentSummary }) {
  const { agentName, workerNames, enablement } = agent;
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  return (
    <Item variant="outline" role="listitem">
      <ItemHeader className="flex-wrap">
        <ItemTitle>
          <Link
            to={`/agents/${encodeURIComponent(agentName)}`}
            className="font-mono underline-offset-4 hover:underline"
          >
            {agentName}
          </Link>
        </ItemTitle>
        <Badge variant={enablementVariant(enablement)}>{enablementLabel(enablement)}</Badge>
        <NewSessionButton
          size="sm"
          label={`New session with ${agentName}`}
          unavailableReason={newSessionUnavailableReason(enablement?.state ?? null)}
          onStart={() => setStarting(true)}
        />
      </ItemHeader>
      {starting && (
        <NewSessionDialog
          agents={[agent]}
          initialAgentName={agentName}
          onClose={() => setStarting(false)}
          onCreated={(session) => navigate(workbenchSessionPath(session.id))}
        />
      )}
      <ItemContent className="min-w-0 gap-3">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Workers</dt>
          <dd className="font-mono break-all">
            {workerNames.map((name, index) => (
              <Fragment key={name}>
                {index > 0 && ", "}
                <RecordName>{name}</RecordName>
              </Fragment>
            ))}
          </dd>
          {enablement !== null && (
            <>
              <dt className="text-muted-foreground">Agent providers</dt>
              <dd className="font-mono break-all">
                {enablement.agent_providers.map((p, index) => (
                  <Fragment key={p.name}>
                    {index > 0 && ", "}
                    <RecordName>{p.name}</RecordName>
                  </Fragment>
                ))}
              </dd>
              <dt className="text-muted-foreground">Default</dt>
              <dd className="font-mono break-all">
                <RecordName>{enablement.default_configuration.agent_provider}</RecordName> ·{" "}
                <RecordName>{enablement.default_configuration.model_identifier}</RecordName> ·{" "}
                {enablement.default_configuration.reasoning_effort}
              </dd>
            </>
          )}
        </dl>
      </ItemContent>
    </Item>
  );
}

export function AgentsScreen() {
  const { data: agents, error, loading, reload } = useAgents();

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
        <AgentItem key={agent.agentName} agent={agent} />
      ))}
    </ItemGroup>
  );
}
