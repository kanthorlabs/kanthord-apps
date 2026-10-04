import { EDGE_GROUP_LABELS, EDGE_GROUPS } from "@/lib/edge-group";
import { EDGE_STYLES } from "./edge-style";

export function EdgeLegend() {
  return (
    <ul
      aria-label="Edge colors"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
    >
      <li>Dependency:</li>
      {EDGE_GROUPS.map((group) => (
        <li key={group} className="flex items-center gap-1.5">
          <svg aria-hidden="true" width="20" height="6">
            <line
              x1="0"
              y1="3"
              x2="20"
              y2="3"
              strokeWidth="2"
              strokeDasharray={EDGE_STYLES[group].dash}
              className={EDGE_STYLES[group].stroke}
            />
          </svg>
          {EDGE_GROUP_LABELS[group]}
        </li>
      ))}
    </ul>
  );
}
