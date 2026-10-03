export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const DIRECT_GAP = 40;
export const GUTTER_OFFSET = 12;

function cubic(
  sx: number,
  sy: number,
  c1x: number,
  c1y: number,
  c2x: number,
  c2y: number,
  ex: number,
  ey: number,
): string {
  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`;
}

export function edgePath(from: Box, to: Box): string {
  const fromRight = from.x + from.width;
  const toRight = to.x + to.width;
  const fromMiddle = from.y + from.height / 2;
  const toMiddle = to.y + to.height / 2;
  const gap = to.y - (from.y + from.height);

  if (gap >= 0 && gap <= DIRECT_GAP) {
    const sx = from.x + from.width / 2;
    const sy = from.y + from.height;
    const ex = to.x + to.width / 2;
    const bend = Math.max(gap / 2, 8);
    return cubic(sx, sy, sx, sy + bend, ex, to.y - bend, ex, to.y);
  }
  if (to.x >= fromRight) {
    const bend = Math.max((to.x - fromRight) / 2, 16);
    return cubic(
      fromRight,
      fromMiddle,
      fromRight + bend,
      fromMiddle,
      to.x - bend,
      toMiddle,
      to.x,
      toMiddle,
    );
  }
  if (toRight <= from.x) {
    const bend = Math.max((from.x - toRight) / 2, 16);
    return cubic(
      from.x,
      fromMiddle,
      from.x - bend,
      fromMiddle,
      toRight + bend,
      toMiddle,
      toRight,
      toMiddle,
    );
  }
  const gutter = Math.max(Math.min(from.x, to.x) - GUTTER_OFFSET, 2);
  return cubic(from.x, fromMiddle, gutter, fromMiddle, gutter, toMiddle, to.x, toMiddle);
}
