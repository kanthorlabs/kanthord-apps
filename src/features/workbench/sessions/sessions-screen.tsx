import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { WorkbenchSessionListItem } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Badge } from "@/components/ui/badge";
import { utcDateTime } from "@/lib/format";
import { sessionTitle } from "@/lib/workbench-sessions";
import { NewSessionButton } from "./components/new-session-button";
import { NewSessionDialog } from "./components/new-session-dialog";
import { useWorkbenchSessions } from "./use-workbench-sessions";

function sessionPath(agentName: string, sessionId: string): string {
  return `/agents/${encodeURIComponent(agentName)}/workbench/${encodeURIComponent(sessionId)}`;
}

export function SessionsScreen() {
  const { agentName = "" } = useParams<{ agentName: string }>();
  const navigate = useNavigate();
  const { status, error, reload, sessions, enablement } = useWorkbenchSessions(agentName);
  const [starting, setStarting] = useState(false);
  const enabled = enablement?.state === "enabled";

  const renderItem = (item: WorkbenchSessionListItem) => {
    const title = sessionTitle(item);
    return (
      <DataListItem
        title={title}
        status={<Badge variant="outline">{item.messageCount} messages</Badge>}
        description={<span className="font-mono">{item.id}</span>}
        fields={[
          { label: "Modified", value: utcDateTime(item.modified) },
          { label: "Created", value: utcDateTime(item.created) },
        ]}
        select={{
          label: `Open ${title}`,
          disabled: false,
          onSelect: () => navigate(sessionPath(agentName, item.id)),
        }}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-lg font-semibold">{agentName}</h2>
        <NewSessionButton available={enabled} onStart={() => setStarting(true)} />
      </div>
      {starting && enablement !== null && (
        <NewSessionDialog
          agentName={agentName}
          enablement={enablement}
          onClose={() => setStarting(false)}
          onCreated={(session) => navigate(sessionPath(agentName, session.id))}
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
        emptyText="No sessions. Start the first one with New Session."
      />
    </div>
  );
}
