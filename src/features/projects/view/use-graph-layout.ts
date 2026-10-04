import type { ELK } from "elkjs/lib/elk-api";
import { useEffect, useMemo, useState, type RefObject } from "react";

import {
  laneGrid,
  layoutRequest,
  placedNodeIds,
  readLayout,
  type GraphLayout,
  type LaneGrid,
} from "@/lib/graph-layout";
import type { GraphModel } from "@/lib/mission-graph";

export const GRAPH_NODE_ATTRIBUTE = "data-graph-node";

export interface GraphLayoutState {
  readonly grid: LaneGrid | null;
  readonly layout: GraphLayout | null;
  readonly error: Error | null;
}

interface Narrowing {
  readonly width: number;
  readonly by: number;
}

interface LayoutResult {
  readonly layout: GraphLayout | null;
  readonly error: Error | null;
}

let engine: Promise<ELK> | null = null;

function loadEngine(): Promise<ELK> {
  engine ??= import("elkjs/lib/elk.bundled.js").then(
    ({ default: Elk }) => new Elk(),
    (cause: unknown) => {
      engine = null;
      throw cause;
    },
  );
  return engine;
}

function measureHeights(container: HTMLElement): ReadonlyMap<string, number> {
  const heights = new Map<string, number>();
  for (const element of container.querySelectorAll<HTMLElement>(`[${GRAPH_NODE_ATTRIBUTE}]`)) {
    const id = element.getAttribute(GRAPH_NODE_ATTRIBUTE);
    if (id !== null) heights.set(id, Math.ceil(element.offsetHeight));
  }
  return heights;
}

function sameHeights(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, height] of a) {
    if (b.get(id) !== height) return false;
  }
  return true;
}

function useContentWidth(containerRef: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(Math.floor(container.clientWidth)));
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return width;
}

function useNodeHeights(
  containerRef: RefObject<HTMLElement | null>,
  grid: LaneGrid | null,
  model: GraphModel,
): ReadonlyMap<string, number> {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || grid === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const next = measureHeights(container);
      setHeights((current) => (sameHeights(current, next) ? current : next));
    });
    for (const element of container.querySelectorAll(`[${GRAPH_NODE_ATTRIBUTE}]`)) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [containerRef, grid, model]);

  return heights;
}

export function useGraphLayout(
  containerRef: RefObject<HTMLElement | null>,
  model: GraphModel,
): GraphLayoutState {
  const width = useContentWidth(containerRef);
  const [narrowing, setNarrowing] = useState<Narrowing>({ width: 0, by: 0 });
  const grid = useMemo(() => {
    if (width <= 0) return null;
    return laneGrid(narrowing.width === width ? width - narrowing.by : width);
  }, [width, narrowing]);
  const heights = useNodeHeights(containerRef, grid, model);
  const [result, setResult] = useState<LayoutResult>({ layout: null, error: null });

  useEffect(() => {
    if (grid === null) return;
    if (placedNodeIds(model).some((id) => !heights.has(id))) return;
    let live = true;
    loadEngine()
      .then((elk) => elk.layout(layoutRequest(model, grid, heights)))
      .then((output) => readLayout(model, output))
      .then(
        (layout) => {
          if (!live) return;
          setResult({ layout, error: null });
          if (layout.width > width && narrowing.width !== width) {
            setNarrowing({ width, by: Math.ceil(layout.width - width) });
          }
        },
        (cause: unknown) => {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          if (live) setResult({ layout: null, error });
        },
      );
    return () => {
      live = false;
    };
  }, [model, grid, heights, width, narrowing]);

  return { grid, layout: result.layout, error: result.error };
}
