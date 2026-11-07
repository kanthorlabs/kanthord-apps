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

function readTarget(holder: string, row: InstanceCredentialRow, setTarget: TargetUpdate) {
  const entry = row.entry;
  if (entry === null) return;
  readCredential("llm", row.copy.name, holder).then(
    (credential) =>
      setTarget((current) => ({
        key: (current?.key ?? 0) + 1,
        credential,
        entry,
        reportedModelIds: row.reportedModelIds,
      })),
    (cause: unknown) => {
      toast.error(`Reading ${row.copy.name} on ${holder} failed.`, {
        description: asApiError(cause).message,
        action: { label: "Retry", onClick: () => readTarget(holder, row, setTarget) },
      });
    },
  );
}

export function useInstanceCopyModels(holder: string): InstanceCopyModelsState {
  const [target, setTarget] = useState<InstanceCopyModelsTarget | null>(null);

  const start = useCallback(
    (row: InstanceCredentialRow) => readTarget(holder, row, setTarget),
    [holder],
  );

  return { target, start };
}
