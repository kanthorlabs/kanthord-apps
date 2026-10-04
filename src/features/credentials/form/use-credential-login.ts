import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  readCredentialLoginStatus,
  startCredentialLogin,
  submitCredentialLoginCode,
} from "@/api/resources/credentials";
import type {
  CredentialLoginMode,
  CredentialLoginSession,
  CredentialLoginStatus,
  CredentialPlatform,
} from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { credentialMessage } from "../credential-message";

export const LOGIN_POLL_MS = 2000;
export const PLATFORM_DEFAULT_MODE = "default";

export type LoginModeChoice = CredentialLoginMode | typeof PLATFORM_DEFAULT_MODE;

const MODES: readonly LoginModeChoice[] = [PLATFORM_DEFAULT_MODE, "browser", "device"];

export interface CredentialLoginState {
  readonly mode: LoginModeChoice;
  readonly starting: boolean;
  readonly startError: string | null;
  readonly session: CredentialLoginSession | null;
  readonly status: CredentialLoginStatus | null;
  readonly pollError: string | null;
  readonly code: string;
  readonly codeError: string | null;
  readonly codeSubmitting: boolean;
  readonly selectMode: (value: string | null) => void;
  readonly start: (name: string, platform: CredentialPlatform) => void;
  readonly clearStartError: () => void;
  readonly setCode: (code: string) => void;
  readonly submitCode: () => void;
  readonly checkAgain: () => void;
  readonly restart: () => void;
}

function failureMessage(cause: unknown): string {
  return credentialMessage(asApiError(cause));
}

export function useCredentialLogin(): CredentialLoginState {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginModeChoice>(PLATFORM_DEFAULT_MODE);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [session, setSession] = useState<CredentialLoginSession | null>(null);
  const [status, setStatus] = useState<CredentialLoginStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [code, setCodeValue] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSubmitting, setCodeSubmitting] = useState(false);

  const waiting =
    session !== null && pollError === null && (status?.state ?? "pending") === "pending";

  useEffect(() => {
    if (!waiting || session === null) return;
    const timer = setTimeout(() => {
      readCredentialLoginStatus(session.sessionId).then(
        (next) => {
          setStatus(next);
          if (next.state !== "completed") return;
          toast.success(`Signed in. Custody stored ${name}.`);
          void navigate(`/credentials/${encodeURIComponent(name)}`);
        },
        (cause: unknown) => setPollError(failureMessage(cause)),
      );
    }, LOGIN_POLL_MS);
    return () => clearTimeout(timer);
  }, [waiting, session, status, name, navigate]);

  const selectMode = useCallback((value: string | null) => {
    const next = MODES.find((candidate) => candidate === value);
    if (next !== undefined) setMode(next);
  }, []);

  const start = useCallback(
    (nextName: string, platform: CredentialPlatform) => {
      if (starting) return;
      setStarting(true);
      setStartError(null);
      startCredentialLogin({
        platform,
        name: nextName,
        ...(mode === PLATFORM_DEFAULT_MODE ? {} : { mode }),
      }).then(
        (next) => {
          setStarting(false);
          setName(nextName);
          setStatus(null);
          setPollError(null);
          setSession(next);
        },
        (cause: unknown) => {
          setStarting(false);
          setStartError(failureMessage(cause));
        },
      );
    },
    [starting, mode],
  );

  const clearStartError = useCallback(() => setStartError(null), []);

  const setCode = useCallback((next: string) => {
    setCodeValue(next);
    setCodeError(null);
  }, []);

  const submitCode = useCallback(() => {
    if (codeSubmitting || session === null) return;
    if (code.trim().length === 0) {
      setCodeError("Paste the code or the redirect URL.");
      return;
    }
    setCodeSubmitting(true);
    setCodeError(null);
    const value = code;
    setCodeValue("");
    submitCredentialLoginCode(session.sessionId, value).then(
      () => {
        setCodeSubmitting(false);
        toast.success("The sign-in received the code.");
      },
      (cause: unknown) => {
        setCodeSubmitting(false);
        setCodeError(failureMessage(cause));
      },
    );
  }, [codeSubmitting, session, code]);

  const checkAgain = useCallback(() => setPollError(null), []);

  const restart = useCallback(() => {
    setSession(null);
    setStatus(null);
    setPollError(null);
    setCodeValue("");
    setCodeError(null);
  }, []);

  return {
    mode,
    starting,
    startError,
    session,
    status,
    pollError,
    code,
    codeError,
    codeSubmitting,
    selectMode,
    start,
    clearStartError,
    setCode,
    submitCode,
    checkAgain,
    restart,
  };
}
