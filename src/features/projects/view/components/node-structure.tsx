import type { MissionTaskContent } from "@/api/types";
import { closureOf, type ClosureStatus, type GraphModel } from "@/lib/mission-graph";
import { NodeLink } from "./node-link";

interface NodeStructureProps {
  readonly model: GraphModel;
  readonly nodeId: string;
  readonly onSelect: (nodeId: string) => void;
}

const CLOSURE_TEXT: Record<ClosureStatus, string> = {
  holds: "The dependency closure holds. Every node that it names is Completed.",
  "does not hold": "The dependency closure does not hold. A node that it names is not Completed.",
  unknown: "The read does not hold every node of the dependency closure, so its state is unknown.",
};

function LinkList({
  label,
  ids,
  empty,
  model,
  onSelect,
}: {
  label: string;
  ids: readonly string[];
  empty: string;
  model: GraphModel;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <h4 className="text-sm font-medium">{label}</h4>
      {ids.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {ids.map((id) => (
            <li key={id} className="flex min-w-0 flex-col">
              <NodeLink model={model} nodeId={id} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskList({ tasks }: { tasks: readonly MissionTaskContent[] }) {
  return (
    <section aria-label="Tasks" className="flex flex-col gap-1">
      <h4 className="text-sm font-medium">Tasks</h4>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The node holds no task, so it is its own single work unit.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex min-w-0 flex-col text-sm">
              <span className="break-words">{task.content.name}</span>
              <span className="text-xs break-all text-muted-foreground">{task.filename}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NodeStructure({ model, nodeId, onSelect }: NodeStructureProps) {
  const node = model.nodeById.get(nodeId);
  if (node === undefined) return null;
  const closure = closureOf(model, nodeId);

  return (
    <div className="flex flex-col gap-4">
      <LinkList
        label="Depends on"
        ids={closure.members.map((member) => member.nodeId)}
        empty="The node names no dependency."
        model={model}
        onSelect={onSelect}
      />
      {closure.members.length > 0 && <p className="text-sm">{CLOSURE_TEXT[closure.status]}</p>}
      <LinkList
        label="Dependents"
        ids={model.dependents.get(nodeId) ?? []}
        empty="No node depends on this node."
        model={model}
        onSelect={onSelect}
      />
      {node.work === "implement" && <TaskList tasks={node.tasks} />}
    </div>
  );
}
