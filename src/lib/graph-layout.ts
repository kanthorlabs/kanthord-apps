import type { ElkExtendedEdge, ElkNode, ElkPoint } from "elkjs/lib/elk-api";

import type { DependencyLink, GraphModel } from "./mission-graph";

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LaneGrid {
  readonly lanes: number;
  readonly laneWidth: number;
  readonly bandWidth: number;
}

export interface EdgeShape extends DependencyLink {
  readonly path: string;
}

export interface EdgeGeometry {
  readonly width: number;
  readonly height: number;
  readonly edges: readonly EdgeShape[];
}

export interface BandShape {
  readonly initiativeId: string;
  readonly box: Box;
}

export interface GraphLayout extends EdgeGeometry {
  readonly boxes: ReadonlyMap<string, Box>;
  readonly bands: readonly BandShape[];
}

const LANE_GAP = 16;
const BAND_PADDING = 8;
const MIN_LANE_WIDTH = 180;
const MAX_LANES = 4;
const EDGE_GUTTER = 16;
const LAYER_GAP = 28;
const CORNER_RADIUS = 6;

export function laneGrid(width: number): LaneGrid {
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error(`The graph width ${width} is not a positive number.`);
  }
  const bandWidth = Math.max(MIN_LANE_WIDTH, Math.floor(width - 2 * BAND_PADDING - EDGE_GUTTER));
  const room = bandWidth;
  const fit = Math.floor((room + LANE_GAP) / (MIN_LANE_WIDTH + LANE_GAP));
  const lanes = Math.min(MAX_LANES, Math.max(1, fit));
  const laneWidth = Math.max(MIN_LANE_WIDTH, Math.floor((room - (lanes - 1) * LANE_GAP) / lanes));
  return { lanes, laneWidth, bandWidth };
}

export function placedNodeIds(model: GraphModel): readonly string[] {
  return model.initiatives.flatMap((block) => [
    block.node.id,
    ...block.rows.flatMap((row) => row.map((cell) => cell.node.id)),
  ]);
}

function edgeId(link: DependencyLink): string {
  return `${link.dependsOnId}->${link.dependentId}`;
}

function sized(id: string, width: number, heights: ReadonlyMap<string, number>, partition: number) {
  const height = heights.get(id);
  if (height === undefined) throw new Error(`The graph holds no measured height for ${id}.`);
  return {
    id,
    width,
    height,
    layoutOptions: { "elk.partitioning.partition": String(partition) },
  };
}

export function layoutRequest(
  model: GraphModel,
  grid: LaneGrid,
  heights: ReadonlyMap<string, number>,
): ElkNode {
  const children = model.initiatives.flatMap((block, index) => [
    sized(block.node.id, grid.bandWidth, heights, 2 * index),
    ...block.rows.flatMap((row) =>
      row.map((cell) => sized(cell.node.id, grid.laneWidth, heights, 2 * index + 1)),
    ),
  ]);
  const placed = new Set(children.map((child) => child.id));
  const edges: ElkExtendedEdge[] = model.links
    .filter((link) => placed.has(link.dependsOnId) && placed.has(link.dependentId))
    .map((link) => ({
      id: edgeId(link),
      sources: [link.dependsOnId],
      targets: [link.dependentId],
    }));
  return {
    id: "mission",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.separateConnectedComponents": "false",
      "elk.partitioning.activate": "true",
      "elk.layered.layering.strategy": "COFFMAN_GRAHAM",
      "elk.layered.layering.coffmanGraham.layerBound": String(grid.lanes),
      "elk.layered.nodePlacement.strategy": "SIMPLE",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.spacing.nodeNode": String(LANE_GAP),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(LAYER_GAP),
      "elk.layered.spacing.edgeNodeBetweenLayers": "10",
      "elk.spacing.edgeEdge": "6",
      "elk.spacing.edgeNode": "8",
      "elk.padding": `[top=${BAND_PADDING},left=${BAND_PADDING},bottom=${BAND_PADDING},right=${BAND_PADDING}]`,
    },
    children,
    edges,
  };
}

function cornerTo(from: ElkPoint, corner: ElkPoint, to: ElkPoint): string {
  const before = Math.hypot(corner.x - from.x, corner.y - from.y);
  const after = Math.hypot(to.x - corner.x, to.y - corner.y);
  const radius = Math.min(CORNER_RADIUS, before / 2, after / 2);
  if (radius === 0) return `L ${corner.x} ${corner.y}`;
  const entry = {
    x: corner.x - ((corner.x - from.x) / before) * radius,
    y: corner.y - ((corner.y - from.y) / before) * radius,
  };
  const exit = {
    x: corner.x + ((to.x - corner.x) / after) * radius,
    y: corner.y + ((to.y - corner.y) / after) * radius,
  };
  return `L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y}, ${exit.x} ${exit.y}`;
}

export function roundedPath(points: readonly ElkPoint[]): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined || points.length < 2) {
    throw new Error("An edge path needs at least two points.");
  }
  const segments = [`M ${first.x} ${first.y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    segments.push(
      cornerTo(
        points[index - 1] as ElkPoint,
        points[index] as ElkPoint,
        points[index + 1] as ElkPoint,
      ),
    );
  }
  segments.push(`L ${last.x} ${last.y}`);
  return segments.join(" ");
}

function edgePoints(edge: ElkExtendedEdge): ElkPoint[] {
  const sections = edge.sections ?? [];
  if (sections.length === 0) throw new Error(`The layout holds no route for the edge ${edge.id}.`);
  return sections.flatMap((section) => [
    section.startPoint,
    ...(section.bendPoints ?? []),
    section.endPoint,
  ]);
}

function boxOf(node: ElkNode): Box {
  const { x, y, width, height } = node;
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    throw new Error(`The layout holds no position for ${node.id}.`);
  }
  return { x, y, width, height };
}

function bandOf(model: GraphModel, index: number, boxes: ReadonlyMap<string, Box>, width: number) {
  const block = model.initiatives[index];
  const header = block === undefined ? undefined : boxes.get(block.node.id);
  if (block === undefined || header === undefined) {
    throw new Error(`The layout holds no initiative at band ${index}.`);
  }
  const members = block.rows.flatMap((row) => row.map((cell) => boxes.get(cell.node.id)));
  const bottom = Math.max(
    ...members.map((box) => (box ? box.y + box.height : 0)),
    header.y + header.height,
  );
  return {
    initiativeId: block.node.id,
    box: {
      x: 0,
      y: header.y - BAND_PADDING,
      width,
      height: bottom - header.y + 2 * BAND_PADDING,
    },
  };
}

export function readLayout(model: GraphModel, result: ElkNode): GraphLayout {
  const width = result.width ?? 0;
  const height = result.height ?? 0;
  if (width <= 0 || height <= 0) throw new Error("The layout holds no graph size.");
  const boxes = new Map((result.children ?? []).map((child) => [child.id, boxOf(child)]));
  const links = new Map(model.links.map((link) => [edgeId(link), link]));
  const edges = (result.edges ?? []).map((edge): EdgeShape => {
    const link = links.get(edge.id);
    if (link === undefined) throw new Error(`The layout holds an unknown edge ${edge.id}.`);
    return { ...link, path: roundedPath(edgePoints(edge)) };
  });
  const bands = model.initiatives.map((_, index) => bandOf(model, index, boxes, width));
  return { width, height, edges, boxes, bands };
}
