import type { EdgeGroup } from "@/lib/edge-group";

export interface EdgeStyle {
  readonly stroke: string;
  readonly fill: string;
  readonly dash: string | undefined;
}

export const EDGE_STYLES: Record<EdgeGroup, EdgeStyle> = {
  done: { stroke: "stroke-muted-foreground", fill: "fill-muted-foreground", dash: undefined },
  waiting: { stroke: "stroke-edge-waiting", fill: "fill-edge-waiting", dash: undefined },
  stuck: { stroke: "stroke-destructive", fill: "fill-destructive", dash: "5 4" },
};
