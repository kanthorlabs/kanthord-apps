import { useCallback, useState } from "react";

import type { ApiError } from "@/api/errors";
import {
  applyMissionImport,
  exportMissionJson,
  previewMissionImport,
  readMission,
} from "@/api/resources/mission";
import type { MissionImportPreview, MissionImportResult, MissionImportSnapshot } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import {
  importInputOf,
  importSnapshotOf,
  nodeNames,
  type ImportInput,
  type PickedFile,
} from "@/lib/mission-plan";

export interface ReviewedPreview {
  readonly snapshot: MissionImportSnapshot;
  readonly preview: MissionImportPreview;
  readonly names: ReadonlyMap<string, string>;
}

export interface MissionImportState {
  readonly fileNames: readonly string[];
  readonly inputError: string | null;
  readonly reason: string;
  readonly reviewed: ReviewedPreview | null;
  readonly retirementsConfirmed: boolean;
  readonly canPreview: boolean;
  readonly canApply: boolean;
  readonly pending: boolean;
  readonly error: ApiError | null;
  readonly staleNotice: string | null;
  readonly result: MissionImportResult | null;
  readonly createdCount: number;
  readonly pickFiles: (files: readonly File[]) => void;
  readonly setReason: (reason: string) => void;
  readonly confirmRetirements: (confirmed: boolean) => void;
  readonly preview: () => void;
  readonly apply: () => void;
  readonly reset: () => void;
}

const STALE_NOTICE =
  "The mission changed after this preview. Review the new preview before you apply.";

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error(`${file.name} could not be read.`));
    reader.readAsText(file);
  });
}

function readPicked(files: readonly File[]): Promise<readonly PickedFile[]> {
  return Promise.all(files.map(async (file) => ({ name: file.name, text: await readText(file) })));
}

export function useMissionImport(projectId: string, onApplied: () => void): MissionImportState {
  const [fileNames, setFileNames] = useState<readonly string[]>([]);
  const [input, setInput] = useState<ImportInput | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [reason, setReasonValue] = useState("");
  const [reviewed, setReviewed] = useState<ReviewedPreview | null>(null);
  const [retirementsConfirmed, setRetirementsConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [result, setResult] = useState<MissionImportResult | null>(null);
  const [createdCount, setCreatedCount] = useState(0);

  const invalidatePreview = useCallback(() => {
    setReviewed(null);
    setRetirementsConfirmed(false);
    setError(null);
    setResult(null);
  }, []);

  const pickFiles = useCallback(
    (files: readonly File[]) => {
      invalidatePreview();
      setStaleNotice(null);
      setFileNames(files.map((file) => file.name));
      readPicked(files).then(
        (picked) => {
          const parsed = importInputOf(picked);
          setInput(parsed.ok ? parsed.input : null);
          setInputError(parsed.ok ? null : parsed.error);
        },
        () => {
          setInput(null);
          setInputError("The picked files could not be read.");
        },
      );
    },
    [invalidatePreview],
  );

  const setReason = useCallback(
    (next: string) => {
      invalidatePreview();
      setReasonValue(next);
    },
    [invalidatePreview],
  );

  const preview = useCallback(() => {
    if (pending || input === null || reason.trim().length === 0) return;
    setPending(true);
    invalidatePreview();
    readMission(projectId)
      .then(async (mission) => {
        const snapshot = importSnapshotOf(input, mission.id, mission.version, reason);
        const [next, current] = await Promise.all([
          previewMissionImport(snapshot),
          exportMissionJson(mission.id),
        ]);
        return { snapshot, preview: next, names: nodeNames(current.entries) };
      })
      .then(
        (next) => {
          setPending(false);
          setStaleNotice(null);
          setReviewed(next);
        },
        (cause: unknown) => {
          setPending(false);
          setError(asApiError(cause));
        },
      );
  }, [pending, input, reason, projectId, invalidatePreview]);

  const apply = useCallback(() => {
    if (pending || reviewed === null) return;
    const { snapshot, preview: shown } = reviewed;
    if (shown.violations.length > 0) return;
    if (shown.retirements.length > 0 && !retirementsConfirmed) return;
    setPending(true);
    setError(null);
    applyMissionImport({
      ...snapshot,
      previewDigest: shown.previewDigest,
      confirmedRetirements: shown.retirements,
    }).then(
      (applied) => {
        setPending(false);
        setReviewed(null);
        setRetirementsConfirmed(false);
        setResult(applied);
        setCreatedCount(shown.creates.length);
        onApplied();
      },
      (cause: unknown) => {
        setPending(false);
        const failure = asApiError(cause);
        if (failure.status === 409) {
          setReviewed(null);
          setRetirementsConfirmed(false);
          setStaleNotice(STALE_NOTICE);
          return;
        }
        setError(failure);
      },
    );
  }, [pending, reviewed, retirementsConfirmed, onApplied]);

  const reset = useCallback(() => {
    invalidatePreview();
    setFileNames([]);
    setInput(null);
    setInputError(null);
    setReasonValue("");
    setStaleNotice(null);
  }, [invalidatePreview]);

  const shown = reviewed?.preview;
  return {
    fileNames,
    inputError,
    reason,
    reviewed,
    retirementsConfirmed,
    canPreview: !pending && input !== null && reason.trim().length > 0,
    canApply:
      !pending &&
      shown !== undefined &&
      shown.violations.length === 0 &&
      (shown.retirements.length === 0 || retirementsConfirmed),
    pending,
    error,
    staleNotice,
    result,
    createdCount,
    pickFiles,
    setReason,
    confirmRetirements: setRetirementsConfirmed,
    preview,
    apply,
    reset,
  };
}
