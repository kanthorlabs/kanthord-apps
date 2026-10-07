import { useCallback, useState } from "react";

import type { ApiError } from "@/api/errors";
import { exportMissionJson, exportMissionMarkdown } from "@/api/resources/mission";
import { asApiError } from "@/hooks/use-resource";
import { missionExportFilename, planArchive } from "@/lib/mission-plan";

export interface MissionExportState {
  readonly exporting: boolean;
  readonly error: ApiError | null;
  readonly exportJson: () => void;
  readonly exportMarkdown: () => void;
}

interface ExportFile {
  readonly filename: string;
  readonly blob: Blob;
}

function download({ filename, blob }: ExportFile): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useMissionExport(
  missionId: string | null,
  projectName: string,
): MissionExportState {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(
    (read: (missionId: string) => Promise<ExportFile>) => {
      if (missionId === null || exporting) return;
      setExporting(true);
      setError(null);
      read(missionId).then(
        (file) => {
          setExporting(false);
          download(file);
        },
        (cause: unknown) => {
          setExporting(false);
          setError(asApiError(cause));
        },
      );
    },
    [missionId, exporting],
  );

  const exportJson = useCallback(
    () =>
      run(async (id) => {
        const plan = await exportMissionJson(id);
        return {
          filename: missionExportFilename(projectName, plan.mission_version, "json"),
          blob: new Blob([`${JSON.stringify(plan, null, 2)}\n`], { type: "application/json" }),
        };
      }),
    [run, projectName],
  );

  const exportMarkdown = useCallback(
    () =>
      run(async (id) => {
        const plan = await exportMissionMarkdown(id);
        return {
          filename: missionExportFilename(projectName, plan.mission_version, "zip"),
          blob: new Blob([planArchive(plan.files)], { type: "application/zip" }),
        };
      }),
    [run, projectName],
  );

  return { exporting, error, exportJson, exportMarkdown };
}
