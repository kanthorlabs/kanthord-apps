import { type ReactNode, useRef } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { GraphLayout } from "@/lib/graph-layout";
import { dependencyNames, type GraphModel } from "@/lib/mission-graph";
import { GRAPH_NODE_ATTRIBUTE, useGraphLayout } from "../use-graph-layout";
import { DependencyEdges } from "./dependency-edges";
import { EdgeLegend } from "./edge-legend";
import { GraphNode } from "./graph-node";

interface MissionGraphProps {
  readonly model: GraphModel;
  readonly selectedId: string | null;
  readonly onSelect: (nodeId: string) => void;
}

interface PlacedProps {
  readonly nodeId: string;
  readonly layout: GraphLayout | null;
  readonly width: number | undefined;
  readonly children: ReactNode;
}

function Placed({ nodeId, layout, width, children }: PlacedProps) {
  const box = layout?.boxes.get(nodeId);
  return (
    <div
      {...{ [GRAPH_NODE_ATTRIBUTE]: nodeId }}
      className="absolute flex"
      style={{ left: box?.x ?? 0, top: box?.y ?? 0, width }}
    >
      {children}
    </div>
  );
}

export function MissionGraph({ model, selectedId, onSelect }: MissionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { grid, layout, error } = useGraphLayout(containerRef, model);

  return (
    <>
      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {model.links.length > 0 && <EdgeLegend />}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto overscroll-x-contain contain-inline-size"
      >
        <div
          className={`relative ${layout === null ? "invisible" : ""}`}
          style={{ width: layout?.width, height: layout?.height }}
        >
          {layout !== null && <DependencyEdges geometry={layout} selectedId={selectedId} />}
          <ol aria-label="Nodes">
            {model.rows.flat().map((node) => (
              <li key={node.id}>
                <Placed nodeId={node.id} layout={layout} width={grid?.laneWidth}>
                  <GraphNode
                    node={node}
                    dependsOn={dependencyNames(model, node.id)}
                    selectedId={selectedId}
                    onSelect={onSelect}
                  />
                </Placed>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
