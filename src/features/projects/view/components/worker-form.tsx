import type { Resource } from "@/hooks/use-resource";
import { SearchChoiceField } from "@/components/search-choice-field";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import {
  agentRowsOf,
  withAgentEntry,
  type AgentEntryDraft,
  type DraftErrors,
  type WorkerDraft,
} from "@/lib/binding-draft";
import type { WorkerAgents } from "../use-worker-agents";
import { DraftField } from "./draft-field";
import { WorkerAgentItem } from "./worker-agent-item";

interface WorkerAgentListProps {
  readonly draft: WorkerDraft;
  readonly errors: DraftErrors;
  readonly agents: Resource<WorkerAgents>;
  readonly onEdit: (draft: WorkerDraft) => void;
}

function WorkerAgentList({ draft, errors, agents, onEdit }: WorkerAgentListProps) {
  if (draft.worker === "")
    return <p className="text-sm text-muted-foreground">Choose a worker to see its agents.</p>;
  if (agents.loading) return <Skeleton className="h-16 w-full" />;
  if (agents.error !== null)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-destructive">{agents.error.message}</p>
        <Button size="sm" variant="outline" onClick={agents.reload}>
          Retry
        </Button>
      </div>
    );
  const data = agents.data;
  if (data === null) return null;
  if (data.external)
    return (
      <p className="text-sm text-muted-foreground">
        The harness of this worker selects and authenticates its agents. The binding holds no agent
        configuration.
      </p>
    );
  const rows = agentRowsOf(
    data.agents.map((agent) => agent.agentName),
    draft.entries,
  );
  const editEntry = (index: number, entry: AgentEntryDraft) =>
    onEdit({
      ...draft,
      entries: draft.entries.map((current, position) => (position === index ? entry : current)),
    });
  return (
    <ItemGroup aria-label="Agents" className="gap-2">
      {rows.map((row) => (
        <WorkerAgentItem
          key={row.agent}
          agentName={row.agent}
          agent={data.agents.find((agent) => agent.agentName === row.agent) ?? null}
          entry={row.index === null ? null : (draft.entries[row.index] ?? null)}
          index={row.index}
          errors={errors}
          onCustom={(custom) => onEdit(withAgentEntry(draft, row.agent, custom))}
          onEdit={(entry) => row.index !== null && editEntry(row.index, entry)}
        />
      ))}
    </ItemGroup>
  );
}

interface WorkerFormProps {
  readonly draft: WorkerDraft;
  readonly errors: DraftErrors;
  readonly creating: boolean;
  readonly workers: readonly string[];
  readonly agents: Resource<WorkerAgents>;
  readonly onEdit: (draft: WorkerDraft) => void;
}

export function WorkerForm({ draft, errors, creating, workers, agents, onEdit }: WorkerFormProps) {
  return (
    <>
      {creating ? (
        <SearchChoiceField
          id="binding-worker"
          label="Worker"
          value={draft.worker}
          options={workers}
          error={errors["worker"]}
          placeholder="Search workers"
          emptyText="No worker matches."
          description="A worker of the catalog."
          onChange={(worker) => onEdit({ ...draft, worker: worker ?? "", entries: [] })}
        />
      ) : (
        <DraftField
          id="binding-worker"
          label="Worker"
          value={draft.worker}
          error={errors["worker"]}
          readOnly
          description="A worker binding keeps its worker. Remove the binding and add another to change it."
          onChange={(worker) => onEdit({ ...draft, worker })}
        />
      )}
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
      <section aria-label="Agents" className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Agents</h4>
        <WorkerAgentList draft={draft} errors={errors} agents={agents} onEdit={onEdit} />
      </section>
    </>
  );
}
