import { OctagonAlert, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import type { FlowSeverity } from "@/lib/flow-status";
import type { ScorecardTile } from "@/lib/flow-tiles";

import { Sparkline } from "./sparkline";

interface CostTileProps {
  readonly tile: ScorecardTile;
}

const TEXT_TONE: Readonly<Record<FlowSeverity, string>> = {
  ok: "",
  warn: "text-flow-warn",
  bad: "text-flow-bad",
};

const VALUE_SIZE: Readonly<Record<ScorecardTile["kind"], string>> = {
  status: "text-2xl",
  context: "text-lg",
};

function TileIcon({ tile }: CostTileProps) {
  if (tile.icon === "ok") return null;
  const Icon = tile.icon === "bad" ? OctagonAlert : TriangleAlert;
  return (
    <Icon
      role="img"
      aria-label={`${tile.label} status ${tile.icon}`}
      className={`size-4 ${TEXT_TONE[tile.icon]}`}
    />
  );
}

export function CostTile({ tile }: CostTileProps) {
  const { slice, bounds } = tile;
  return (
    <Link to={tile.target} className="block min-w-0 rounded-xl">
      <Card size="sm">
        <CardContent className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-xs text-muted-foreground">{tile.label}</span>
            <TileIcon tile={tile} />
          </div>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className={`font-semibold ${VALUE_SIZE[tile.kind]} ${TEXT_TONE[tile.severity]}`}>
              {tile.value}
            </span>
            {tile.delta !== null && (
              <span className="text-xs text-muted-foreground">{tile.delta}</span>
            )}
          </p>
          <Sparkline
            values={tile.series}
            partial={tile.partial}
            warn={bounds?.warn}
            bad={bounds?.bad}
            label={tile.label.toLowerCase()}
            slice={slice ?? undefined}
            format={tile.format}
          />
          {tile.line !== null && (
            <p
              className={`text-xs break-words ${tile.muted ? "text-muted-foreground" : TEXT_TONE[tile.severity]}`}
            >
              {tile.line}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
