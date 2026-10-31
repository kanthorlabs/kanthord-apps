export const BOARD_WIDTH = {
  Compact: "compact",
  Medium: "medium",
  Expanded: "expanded",
} as const;

export type BoardWidth = (typeof BOARD_WIDTH)[keyof typeof BOARD_WIDTH];

const MEDIUM_FROM_PX = 600;
const EXPANDED_FROM_PX = 960;

export function boardWidthClassOf(width: number): BoardWidth {
  if (width < MEDIUM_FROM_PX) return BOARD_WIDTH.Compact;
  if (width < EXPANDED_FROM_PX) return BOARD_WIDTH.Medium;
  return BOARD_WIDTH.Expanded;
}
