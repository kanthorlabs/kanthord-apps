import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { WorkbenchSessionListItem } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Badge } from "@/components/ui/badge";
import { utcDateTime } from "@/lib/format";
import {
  newSessionUnavailableReason,
  sessionTitle,
  workbenchSessionPath,
} from "@/lib/workbench-sessions";
import { AgentFilter } from "./components/agent-filter";
import { NewSessionButton } from "./components/new-session-button";
import { NewSessionDialog } from "./components/new-session-dialog";
import { ALL_AGENTS, useWorkbenchSessions } from "./use-workbench-sessions";

function agentLabel(value: string): string {
  return value === ALL_AGENTS ? "All agents" : value;
}

export function SessionsScreen() {
  const navigate = useNavigate();
  const { status, error, reload, sessions, agentName, agentOptions, selectAgent, enablement } =
    useWorkbenchSessions();
  const [starting, setStarting] = useState(false);

  const renderItem = (item: WorkbenchSessionListItem) => {
    const title = sessionTitle(item);
    return (
      <DataListItem
        title={title}
        status={
          <>
            <Badge variant="secondary">{item.agentName}</Badge>
            <Badge variant="outline">{item.messageCount} messages</Badge>
          </>
        }
        description={<span className="font-mono">{item.id}</span>}
        fields={[
          { label: "Modified", value: utcDateTime(item.modified) },
          { label: "Created", value: utcDateTime(item.created) },
        ]}
        select={{
          label: `Open ${title}`,
          disabled: false,
          onSelect: () => navigate(workbenchSessionPath(item.id)),
        }}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full md:w-64">
          <AgentFilter
            value={agentName ?? ALL_AGENTS}
            options={agentOptions}
            labelOf={agentLabel}
            onChange={selectAgent}
          />
        </div>
        <div className="flex gap-2 md:ml-auto">
          <NewSessionButton
            unavailableReason={newSessionUnavailableReason(agentName, enablement?.state ?? null)}
            onStart={() => setStarting(true)}
          />
        </div>
      </div>
      {starting && agentName !== null && enablement !== null && (
        <NewSessionDialog
          agentName={agentName}
          enablement={enablement}
          onClose={() => setStarting(false)}
          onCreated={(session) => navigate(workbenchSessionPath(session.id))}
        />
      )}
      <DataList
        label="Sessions"
        items={sessions}
        getKey={(item) => item.id}
        renderItem={renderItem}
        status={status}
        error={error?.message ?? null}
        pending={false}
        onRetry={reload}
        emptyText={
          agentName === null
            ? "No sessions. Pick an agent and start the first one with New Session."
            : `No sessions of ${agentName}. Start the first one with New Session.`
        }
      />
    </div>
  );
}
