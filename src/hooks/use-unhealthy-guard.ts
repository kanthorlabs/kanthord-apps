import { useCallback, useRef, useState } from "react";

import { verifyCredential } from "@/api/resources/credentials";
import type { HealthEntry } from "@/api/types";
import { healthEntryHint } from "@/lib/failure-reason";

export interface UnhealthyGuard {
  readonly credential: string | null;
  readonly hint: string | null;
  readonly check: (credential: string) => void;
  readonly run: (credential: string, proceed: () => void) => void;
  readonly runChecked: (credential: string, entry: HealthEntry | null, proceed: () => void) => void;
  readonly confirm: () => void;
  readonly cancel: () => void;
}

interface Verdict {
  readonly credential: string;
  readonly answer: Promise<HealthEntry | null>;
  entry: HealthEntry | null | undefined;
}

interface Pending {
  readonly credential: string;
  readonly entry: HealthEntry;
  readonly proceed: () => void;
}

export function useUnhealthyGuard(): UnhealthyGuard {
  const [pending, setPending] = useState<Pending | null>(null);
  const verdict = useRef<Verdict | null>(null);

  const check = useCallback((credential: string) => {
    if (credential === "") {
      verdict.current = null;
      return;
    }
    const answer = verifyCredential("llm", credential).then(
      (entry) => entry,
      () => null,
    );
    const next: Verdict = { credential, answer, entry: undefined };
    void answer.then((entry) => {
      next.entry = entry;
    });
    verdict.current = next;
  }, []);

  const runChecked = useCallback(
    (credential: string, entry: HealthEntry | null, proceed: () => void) => {
      if (entry?.status === "unhealthy") setPending({ credential, entry, proceed });
      else proceed();
    },
    [],
  );

  const run = useCallback(
    (credential: string, proceed: () => void) => {
      const current = verdict.current;
      if (current === null || current.credential !== credential) {
        proceed();
        return;
      }
      if (current.entry !== undefined) {
        runChecked(credential, current.entry, proceed);
        return;
      }
      void current.answer.then((entry) => {
        if (verdict.current === current) runChecked(credential, entry, proceed);
      });
    },
    [runChecked],
  );

  const confirm = useCallback(() => {
    const target = pending;
    setPending(null);
    target?.proceed();
  }, [pending]);

  const cancel = useCallback(() => setPending(null), []);

  return {
    credential: pending?.credential ?? null,
    hint: pending === null ? null : healthEntryHint(pending.entry),
    check,
    run,
    runChecked,
    confirm,
    cancel,
  };
}
