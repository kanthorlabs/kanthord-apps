import { useCallback, useState } from "react";
import { toast } from "sonner";

import { listAllFootprintCandidates, readFootprintKind } from "@/api/resources/footprint";
import type { FootprintKind, WorkerPlacement } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { FOOTPRINT_CLEANUP_KEYS_MAX, FOOTPRINT_DEFAULT_AGE_DAYS } from "@/lib/footprint";
import { type CleanupPlan, oversizedCall, PRESET_RULE, presetPlan } from "./cleanup-plan";

const PRESET_KINDS: readonly FootprintKind[] = ["trace", "session"];

export interface FootprintPresetState {
  readonly available: boolean;
  readonly preparing: boolean;
  readonly prepare: () => void;
}

async function readPreset(
  placements: ReadonlyMap<string, WorkerPlacement>,
): Promise<CleanupPlan | null> {
  const [traces, sessions] = await Promise.all([
    listAllFootprintCandidates("trace", { instance_name: null, rule: PRESET_RULE }),
    readFootprintKind("session"),
  ]);
  const names = sessions.stats.flatMap((stat) =>
    stat.delete_operation === null || stat.instance_name === null || stat.stale
      ? []
      : [stat.instance_name],
  );
  const hosts = await Promise.all(
    names.map(async (instanceName) => ({
      instanceName,
      placement: placements.get(instanceName) ?? null,
      candidates: await listAllFootprintCandidates("session", {
        instance_name: instanceName,
        rule: PRESET_RULE,
      }),
    })),
  );
  return presetPlan(traces, hosts);
}

export function useFootprintPreset(
  kind: FootprintKind,
  placements: ReadonlyMap<string, WorkerPlacement>,
  request: (plan: CleanupPlan) => void,
): FootprintPresetState {
  const [preparing, setPreparing] = useState(false);

  const prepare = useCallback(() => {
    setPreparing(true);
    readPreset(placements).then(
      (plan) => {
        setPreparing(false);
        if (plan === null) {
          toast.info(
            `No execution older than ${FOOTPRINT_DEFAULT_AGE_DAYS} days holds both a trace and an agent session.`,
          );
          return;
        }
        if (oversizedCall(plan) !== null) {
          toast.error(`The preset holds more than ${FOOTPRINT_CLEANUP_KEYS_MAX} keys.`, {
            description: "Narrow the set with a larger age in the rule picker.",
          });
          return;
        }
        request(plan);
      },
      (cause: unknown) => {
        setPreparing(false);
        toast.error("The preset read failed.", { description: asApiError(cause).message });
      },
    );
  }, [placements, request]);

  return { available: PRESET_KINDS.includes(kind), preparing, prepare };
}
