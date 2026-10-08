import { useCallback, useEffect, useState } from "react";

import type { ApiError } from "@/api/errors";
import { readInstructionFiles } from "@/api/resources/projects";
import type { InstructionFiles } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

const CLOCK_TICK_MS = 30_000;

export type InstructionFilesView =
  | { readonly status: "unsaved" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly files: InstructionFiles }
  | { readonly status: "refused"; readonly error: ApiError };

export interface InstructionFilesState {
  readonly view: InstructionFilesView;
  readonly now: number;
  readonly refresh: () => void;
  readonly absentShown: boolean;
  readonly showAbsent: () => void;
}

type Settled =
  | { readonly key: string; readonly files: InstructionFiles }
  | { readonly key: string; readonly error: ApiError };

export function useInstructionFiles(
  projectId: string,
  bindingId: string | null,
  allowed: boolean,
): InstructionFilesState {
  const [settled, setSettled] = useState<Settled | null>(null);
  const [round, setRound] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [absentShown, setAbsentShown] = useState(false);
  const readable = allowed && bindingId !== null;
  const key = `${projectId}:${bindingId}:${round}`;

  useEffect(() => {
    if (!readable) return;
    let live = true;
    readInstructionFiles(projectId, bindingId).then(
      (files) => {
        if (!live) return;
        setSettled({ key, files });
        setNow(Date.now());
      },
      (cause: unknown) => {
        if (live) setSettled({ key, error: asApiError(cause) });
      },
    );
    return () => {
      live = false;
    };
  }, [readable, projectId, bindingId, key]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(() => setRound((value) => value + 1), []);
  const showAbsent = useCallback(() => setAbsentShown(true), []);

  let view: InstructionFilesView;
  if (!readable) view = { status: "unsaved" };
  else if (settled === null || settled.key !== key) view = { status: "loading" };
  else if ("files" in settled) view = { status: "ready", files: settled.files };
  else view = { status: "refused", error: settled.error };

  return { view, now, refresh, absentShown, showAbsent };
}
