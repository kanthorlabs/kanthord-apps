import { DownloadIcon, UploadIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useMission } from "../use-mission";
import { useMissionExport } from "../use-mission-export";
import { useMissionImport } from "../use-mission-import";
import { ImportSheet } from "./import-sheet";

interface MissionPanelProps {
  readonly projectId: string;
  readonly projectName: string;
}

export function MissionPanel({ projectId, projectName }: MissionPanelProps) {
  const mission = useMission(projectId);
  const exporter = useMissionExport(mission.data?.id ?? null, projectName);
  const importer = useMissionImport(projectId, mission.reload);
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
      <section
        aria-label="Mission graph"
        className="flex min-h-80 flex-1 items-center justify-center rounded-lg border border-dashed"
      >
        {mission.loading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Mission graph</EmptyTitle>
              <EmptyDescription>The graph view comes next.</EmptyDescription>
            </EmptyHeader>
          </Empty>
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
