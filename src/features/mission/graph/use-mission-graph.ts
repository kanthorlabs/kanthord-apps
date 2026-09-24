import { useMemo, useState } from "react";

import type { ApiError } from "@/api/errors";
import { listNodes } from "@/api/resources/mission";
import type { MissionNode, NodeState } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useResource } from "@/hooks/use-resource";

export interface TreeNode {
  readonly node: MissionNode;
  readonly children: readonly TreeNode[];
}

export type FilterState = NodeState | "task";

function collectVisibleIds(
  nodes: readonly MissionNode[],
  activeStates: ReadonlySet<FilterState>,
  titleFilter: string,
): Set<string> {
  const lower = titleFilter.trim().toLowerCase();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const direct = new Set<string>();
  for (const n of nodes) {
    const titleOk = lower.length === 0 || n.title.toLowerCase().includes(lower);
    const stateOk =
      activeStates.size === 0 ||
      (n.kind === "task"
        ? activeStates.has("task")
        : n.state !== null && activeStates.has(n.state));
    if (titleOk && stateOk) direct.add(n.id);
  }

  const result = new Set<string>(direct);
  for (const id of direct) {
    let current = byId.get(id);
    while (current !== undefined && current.parentId !== null) {
      result.add(current.parentId);
      current = byId.get(current.parentId);
    }
  }

  return result;
}

export function buildTree(nodes: readonly MissionNode[]): TreeNode[] {
  const childrenMap = new Map<string, MissionNode[]>(nodes.map((n) => [n.id, []]));

  const roots: MissionNode[] = [];
  for (const n of nodes) {
    if (n.parentId !== null) {
      const parentChildren = childrenMap.get(n.parentId);
      if (parentChildren !== undefined) {
        parentChildren.push(n);
        continue;
      }
    }
    roots.push(n);
  }

  function toTreeNode(n: MissionNode): TreeNode {
    return {
      node: n,
      children: (childrenMap.get(n.id) ?? []).map(toTreeNode),
    };
  }

  return roots.map(toTreeNode);
}

export interface MissionGraphResult {
  readonly tree: readonly TreeNode[];
  readonly nodeById: ReadonlyMap<string, MissionNode>;
  readonly visibleIds: ReadonlySet<string>;
  readonly activeStates: ReadonlySet<FilterState>;
  readonly titleFilter: string;
  readonly stateCounts: ReadonlyMap<FilterState, number>;
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly reload: () => void;
  readonly toggleState: (s: FilterState) => void;
  readonly setTitleFilter: (v: string) => void;
}

export function useMissionGraph(): MissionGraphResult {
  const projectId = useProjectId();
  const { data, loading, error, reload } = useResource(() => listNodes(projectId), [projectId]);

  const [activeStates, setActiveStates] = useState<ReadonlySet<FilterState>>(new Set());
  const [titleFilter, setTitleFilter] = useState("");

  const allNodes = useMemo(() => data ?? [], [data]);

  const nodeById = useMemo(
    () => new Map<string, MissionNode>(allNodes.map((n) => [n.id, n])),
    [allNodes],
  );

  const tree = useMemo(() => buildTree(allNodes), [allNodes]);

  const stateCounts = useMemo(() => {
    const counts = new Map<FilterState, number>();
    for (const n of allNodes) {
      const key: FilterState = n.kind === "task" ? "task" : (n.state ?? "Pending");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [allNodes]);

  const visibleIds = useMemo(
    () => collectVisibleIds(allNodes, activeStates, titleFilter),
    [allNodes, activeStates, titleFilter],
  );

  const toggleState = (s: FilterState) => {
    setActiveStates((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  return {
    tree,
    nodeById,
    visibleIds,
    activeStates,
    titleFilter,
    stateCounts,
    loading,
    error,
    reload,
    toggleState,
    setTitleFilter,
  };
}
