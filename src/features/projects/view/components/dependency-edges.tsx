import { useId } from "react";

import { EDGE_GROUPS } from "@/lib/edge-group";
import type { EdgeGeometry, EdgeShape } from "@/lib/graph-layout";
import { EDGE_STYLES } from "./edge-style";

interface DependencyEdgesProps {
  readonly geometry: EdgeGeometry;
  readonly selectedId: string | null;
}

function touches(edge: EdgeShape, nodeId: string | null): boolean {
  return edge.dependentId === nodeId || edge.dependsOnId === nodeId;
}

export function DependencyEdges({ geometry, selectedId }: DependencyEdgesProps) {
  const prefix = `edge-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (geometry.edges.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={geometry.width}
      height={geometry.height}
    >
      <defs>
        {EDGE_GROUPS.map((group) => (
          <marker
            key={group}
            id={`${prefix}-${group}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className={EDGE_STYLES[group].fill} />
          </marker>
        ))}
      </defs>
      {geometry.edges.map((edge) => {
        const active = touches(edge, selectedId);
        const faded = selectedId !== null && !active;
        const style = EDGE_STYLES[edge.group];
        return (
          <path
            key={`${edge.dependsOnId}-${edge.dependentId}`}
            d={edge.path}
            fill="none"
            strokeWidth={active ? 2.5 : 1.5}
            strokeDasharray={style.dash}
            className={`${style.stroke} ${faded ? "opacity-25" : ""}`}
            markerEnd={`url(#${prefix}-${edge.group})`}
          />
        );
      })}
    </svg>
  );
}
