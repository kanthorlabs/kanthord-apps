import { useRef } from "react";

import { dependencyNames, objectiveProgress, type GraphModel } from "@/lib/mission-graph";
import { useEdgeGeometry } from "../use-edge-geometry";
import { DependencyEdges } from "./dependency-edges";
import { GraphNode } from "./graph-node";

interface MissionGraphProps {
  readonly model: GraphModel;
  readonly selectedId: string | null;
  readonly onSelect: (nodeId: string) => void;
}

export function MissionGraph({ model, selectedId, onSelect }: MissionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const geometry = useEdgeGeometry(containerRef, model.links);

  return (
    <div ref={containerRef} className="relative pl-6">
      <DependencyEdges geometry={geometry} selectedId={selectedId} />
      <ol aria-label="Initiatives" className="relative flex flex-col gap-10">
        {model.initiatives.map((block) => (
          <li key={block.node.id} className="flex flex-col gap-4">
            <GraphNode
              node={block.node}
              tasks={[]}
              dependsOn={dependencyNames(model, block.node.id)}
              progress={objectiveProgress(model, block.node.id)}
              selectedId={selectedId}
              onSelect={onSelect}
            />
            {block.rows.length > 0 && (
              <ol
                aria-label={`Objectives of ${block.node.content.name}`}
                className="ml-3 flex flex-col gap-6 border-l-2 border-dashed pl-4"
              >
                {block.rows.map((row) => (
                  <li key={row[0]?.node.id}>
                    <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
                      {row.map((cell) => (
                        <li key={cell.node.id} className="flex w-full sm:w-auto">
                          <GraphNode
                            node={cell.node}
                            tasks={cell.tasks}
                            dependsOn={dependencyNames(model, cell.node.id)}
                            progress={null}
                            selectedId={selectedId}
                            onSelect={onSelect}
                          />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
