import { useEffect, useState, type RefObject } from "react";

import { edgePath, type Box } from "@/lib/edge-path";
import type { DependencyLink } from "@/lib/mission-graph";

export const GRAPH_NODE_ATTRIBUTE = "data-graph-node";

export interface EdgeShape extends DependencyLink {
  readonly path: string;
}

export interface EdgeGeometry {
  readonly width: number;
  readonly height: number;
  readonly edges: readonly EdgeShape[];
}

const EMPTY: EdgeGeometry = { width: 0, height: 0, edges: [] };

function measure(container: HTMLElement, links: readonly DependencyLink[]): EdgeGeometry {
  const origin = container.getBoundingClientRect();
  const boxes = new Map<string, Box>();
  for (const element of container.querySelectorAll<HTMLElement>(`[${GRAPH_NODE_ATTRIBUTE}]`)) {
    const id = element.getAttribute(GRAPH_NODE_ATTRIBUTE);
    const rect = element.getBoundingClientRect();
    if (id === null || rect.width === 0) continue;
    boxes.set(id, {
      x: rect.left - origin.left,
      y: rect.top - origin.top,
      width: rect.width,
      height: rect.height,
    });
  }
  const edges: EdgeShape[] = [];
  for (const link of links) {
    const from = boxes.get(link.dependsOnId);
    const to = boxes.get(link.dependentId);
    if (from === undefined || to === undefined) continue;
    edges.push({ ...link, path: edgePath(from, to) });
  }
  return { width: origin.width, height: origin.height, edges };
}

export function useEdgeGeometry(
  containerRef: RefObject<HTMLElement | null>,
  links: readonly DependencyLink[],
): EdgeGeometry {
  const [geometry, setGeometry] = useState<EdgeGeometry>(EMPTY);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setGeometry(measure(container, links)));
    observer.observe(container);
    for (const element of container.querySelectorAll(`[${GRAPH_NODE_ATTRIBUTE}]`)) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [containerRef, links]);

  return geometry;
}
