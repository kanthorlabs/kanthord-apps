import { DownloadIcon, UploadIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useMission } from "../use-mission";
import { useMissionExport } from "../use-mission-export";
import { useMissionGraph } from "../use-mission-graph";
import { useMissionImport } from "../use-mission-import";
import { useNodeSelection } from "../use-node-selection";
import { GraphDiagnostics } from "./graph-diagnostics";
import { ImportSheet } from "./import-sheet";
import { MissionGraph } from "./mission-graph";

interface MissionPanelProps {
  readonly projectId: string;
  readonly projectName: string;
}

export function MissionPanel({ projectId, projectName }: MissionPanelProps) {
  const mission = useMission(projectId);
  const graph = useMissionGraph(projectId);
  const selection = useNodeSelection();
  const { reload: reloadMission } = mission;
  const { reload: reloadGraph } = graph;
  const reloadAll = useCallback(() => {
    reloadMission();
    reloadGraph();
  }, [reloadMission, reloadGraph]);
  const exporter = useMissionExport(mission.data?.id ?? null, projectName);
  const importer = useMissionImport(projectId, reloadAll);
  const [importing, setImporting] = useState(false);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Mission</h3>
          {mission.data !== null && <Badge variant="outline">version {mission.data.version}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={mission.data === null || exporter.exporting}
            onClick={exporter.exportJson}
          >
            <DownloadIcon aria-hidden="true" data-icon="inline-start" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={mission.data === null}
            onClick={() => setImporting(true)}
          >
            <UploadIcon aria-hidden="true" data-icon="inline-start" />
            Import
          </Button>
        </div>
      </div>
      {mission.error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{mission.error.message}</AlertDescription>
        </Alert>
      )}
      {exporter.error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{exporter.error.message}</AlertDescription>
        </Alert>
      )}
      <section aria-label="Mission graph" className="flex min-h-80 flex-1 flex-col gap-3">
        {graph.loading ? (
          <Skeleton className="h-80 w-full" />
        ) : graph.error !== null || graph.data === null ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-col items-start gap-2">
              {graph.error?.message}
              <Button variant="outline" size="sm" onClick={graph.reload}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : graph.data.model.nodeById.size === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>The mission holds no nodes.</EmptyTitle>
                <EmptyDescription>
                  Import a plan to create its initiatives and objectives.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <>
            <GraphDiagnostics
              model={graph.data.model}
              changedDuringRead={graph.data.changedDuringRead}
              onReload={graph.reload}
            />
            <MissionGraph
              model={graph.data.model}
              selectedId={selection.selectedId}
              onSelect={selection.select}
            />
          </>
        )}
      </section>
      <ImportSheet
        open={importing}
        onOpenChange={(open) => {
          setImporting(open);
          if (!open) importer.reset();
        }}
        state={importer}
      />
    </div>
  );
}
