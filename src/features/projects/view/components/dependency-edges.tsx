import { useId } from "react";

import type { EdgeGeometry, EdgeShape } from "../use-edge-geometry";

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
        <marker
          id={`${prefix}-rest`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
        </marker>
        <marker
          id={`${prefix}-active`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
        </marker>
      </defs>
      {geometry.edges.map((edge) => {
        const active = touches(edge, selectedId);
        const faded = selectedId !== null && !active;
        return (
          <path
            key={`${edge.dependsOnId}-${edge.dependentId}`}
            d={edge.path}
            fill="none"
            strokeWidth={active ? 2 : 1.5}
            className={
              active
                ? "stroke-primary"
                : faded
                  ? "stroke-muted-foreground/30"
                  : "stroke-muted-foreground"
            }
            markerEnd={`url(#${prefix}-${active ? "active" : "rest"})`}
          />
        );
      })}
    </svg>
  );
}
