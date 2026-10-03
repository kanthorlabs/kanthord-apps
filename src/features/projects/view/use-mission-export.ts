import { useCallback, useState } from "react";

import type { ApiError } from "@/api/errors";
import { exportMissionJson } from "@/api/resources/mission";
import { asApiError } from "@/hooks/use-resource";
import { missionExportFilename } from "@/lib/mission-plan";

export interface MissionExportState {
  readonly exporting: boolean;
  readonly error: ApiError | null;
  readonly exportJson: () => void;
}

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
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

  const exportJson = useCallback(() => {
    if (missionId === null || exporting) return;
    setExporting(true);
    setError(null);
    exportMissionJson(missionId).then(
      (plan) => {
        setExporting(false);
        download(
          missionExportFilename(projectName, plan.missionVersion),
          `${JSON.stringify(plan, null, 2)}\n`,
        );
      },
      (cause: unknown) => {
        setExporting(false);
        setError(asApiError(cause));
      },
    );
  }, [missionId, exporting, projectName]);

  return { exporting, error, exportJson };
}
