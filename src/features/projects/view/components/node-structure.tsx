import type { ReactNode } from "react";

import {
  closureOf,
  objectiveProgress,
  type ClosureStatus,
  type GraphModel,
} from "@/lib/mission-graph";
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
  note,
}: {
  label: string;
  ids: readonly string[];
  empty: string;
  model: GraphModel;
  onSelect: (nodeId: string) => void;
  note?: (nodeId: string) => ReactNode;
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
              {note?.(id)}
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
  const children = (model.children.get(nodeId) ?? []).map((child) => child.id);
  const closure = closureOf(model, nodeId);
  const progress = node.kind === "initiative" ? objectiveProgress(model, nodeId) : null;

  return (
    <div className="flex flex-col gap-4">
      <LinkList
        label="Parent"
        ids={node.parentId === null ? [] : [node.parentId]}
        empty="An initiative is a root of the mission graph."
        model={model}
        onSelect={onSelect}
      />
      {node.kind !== "task" && (
        <LinkList
          label={node.kind === "initiative" ? "Objectives" : "Tasks"}
          ids={children}
          empty={
            node.kind === "initiative"
              ? "The initiative holds no objective."
              : "The objective holds no task."
          }
          model={model}
          onSelect={onSelect}
        />
      )}
      {progress !== null && (
        <p className="text-sm">
          The initiative waits for its objectives: {progress.terminal} of {progress.total} are
          terminal.
        </p>
      )}
      {node.kind !== "task" && (
        <>
          <LinkList
            label="Depends on"
            ids={model.dependsOn.get(nodeId) ?? []}
            empty="The node names no dependency."
            model={model}
            onSelect={onSelect}
          />
          <LinkList
            label="Dependents"
            ids={model.dependents.get(nodeId) ?? []}
            empty="No node depends on this node."
            model={model}
            onSelect={onSelect}
          />
        </>
      )}
      <LinkList
        label="Dependency closure"
        ids={closure.members.map((member) => member.nodeId)}
        empty="The node and its ancestors name no dependency."
        model={model}
        onSelect={onSelect}
        note={(id) => {
          const via = closure.members.find((member) => member.nodeId === id)?.via;
          return via === undefined || via === nodeId ? null : (
            <span className="pl-2.5 text-xs text-muted-foreground">
              through the ancestor {model.nodeById.get(via)?.content.name ?? via}
            </span>
          );
        }}
      />
      {closure.members.length > 0 && <p className="text-sm">{CLOSURE_TEXT[closure.status]}</p>}
    </div>
  );
}
