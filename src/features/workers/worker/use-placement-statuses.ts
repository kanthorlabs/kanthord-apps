import { useEffect, useState } from "react";

import { listWorkerPlacements } from "@/api/resources/workers";
import type { PlacementStatus } from "@/api/types";

export type PlacementStatuses = readonly PlacementStatus[] | "checking" | "failed";

interface Read {
  readonly opening: number;
  readonly result: readonly PlacementStatus[] | "failed";
}

export function usePlacementStatuses(opening: number): PlacementStatuses {
  const [read, setRead] = useState<Read | null>(null);

  useEffect(() => {
    if (opening === 0) return;
    let live = true;
    listWorkerPlacements().then(
      (result) => {
        if (live) setRead({ opening, result });
      },
      () => {
        if (live) setRead({ opening, result: "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [opening]);

  return read !== null && read.opening === opening ? read.result : "checking";
}
