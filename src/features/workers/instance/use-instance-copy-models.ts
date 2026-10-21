import { useCallback, useState } from "react";
import { toast } from "sonner";

import { readCredential } from "@/api/resources/credentials";
import type { Credential, CredentialPlatformEntry } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import type { InstanceCredentialRow } from "./use-instance-page";

export interface InstanceCopyModelsTarget {
  readonly key: number;
  readonly credential: Credential;
  readonly entry: CredentialPlatformEntry;
  readonly reportedModelIds: readonly string[];
}

export interface InstanceCopyModelsState {
  readonly target: InstanceCopyModelsTarget | null;
  readonly start: (row: InstanceCredentialRow) => void;
}

type TargetUpdate = (
  update: (current: InstanceCopyModelsTarget | null) => InstanceCopyModelsTarget,
) => void;

function readTarget(instanceName: string, row: InstanceCredentialRow, setTarget: TargetUpdate) {
  const entry = row.entry;
  if (entry === null) return;
  readCredential("llm", row.copy.name, instanceName).then(
    (credential) =>
      setTarget((current) => ({
        key: (current?.key ?? 0) + 1,
        credential,
        entry,
        reportedModelIds: row.reportedModelIds,
      })),
    (cause: unknown) => {
      toast.error(`Reading ${row.copy.name} on ${instanceName} failed.`, {
        description: asApiError(cause).message,
        action: { label: "Retry", onClick: () => readTarget(instanceName, row, setTarget) },
      });
    },
  );
}

export function useInstanceCopyModels(instanceName: string): InstanceCopyModelsState {
  const [target, setTarget] = useState<InstanceCopyModelsTarget | null>(null);

  const start = useCallback(
    (row: InstanceCredentialRow) => readTarget(instanceName, row, setTarget),
    [instanceName],
  );

  return { target, start };
}
