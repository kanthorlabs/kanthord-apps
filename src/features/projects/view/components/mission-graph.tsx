import { useRef, type CSSProperties, type ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Box, GraphLayout } from "@/lib/graph-layout";
import { dependencyNames, objectiveProgress, type GraphModel } from "@/lib/mission-graph";
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

function boxStyle(box: Box): CSSProperties {
  return { left: box.x, top: box.y, width: box.width, height: box.height };
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
          {layout?.bands.map((band) => (
            <div
              key={band.initiativeId}
              aria-hidden="true"
              className="absolute rounded-xl bg-muted"
              style={boxStyle(band.box)}
            />
          ))}
          {layout !== null && <DependencyEdges geometry={layout} selectedId={selectedId} />}
          <ol aria-label="Initiatives">
            {model.initiatives.map((block) => (
              <li key={block.node.id}>
                <Placed nodeId={block.node.id} layout={layout} width={grid?.bandWidth}>
                  <GraphNode
                    node={block.node}
                    tasks={[]}
                    dependsOn={dependencyNames(model, block.node.id)}
                    progress={objectiveProgress(model, block.node.id)}
                    selectedId={selectedId}
                    onSelect={onSelect}
                  />
                </Placed>
                {block.rows.length > 0 && (
                  <ol aria-label={`Objectives of ${block.node.content.name}`}>
                    {block.rows.flat().map((cell) => (
                      <li key={cell.node.id}>
                        <Placed nodeId={cell.node.id} layout={layout} width={grid?.laneWidth}>
                          <GraphNode
                            node={cell.node}
                            tasks={cell.tasks}
                            dependsOn={dependencyNames(model, cell.node.id)}
                            progress={null}
                            selectedId={selectedId}
                            onSelect={onSelect}
                          />
                        </Placed>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
