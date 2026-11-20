import { useCallback, useEffect, useState } from "react";

import { basePath } from "@/components/base-path";
import { type ApiError, isApiError } from "@/api/errors";
import { joinInvite } from "@/api/resources/workbench";
import { defaultBaseUrl } from "@/features/auth/login/default-instance";
import { type GuestSessionState, useGuestSession } from "./use-guest-session";

const NAME_INVALID = "workbench.invite.name_invalid";
const NAME_MAX_CHARACTERS = 64;
const NAME_LABEL = "Your name";
const NAME_LABEL_PREFILLED = "Your name (prefilled from the invite, you can change it)";
const NAME_REQUIRED = "Enter a name of 1 to 64 characters.";

export interface JoinFailure {
  readonly code: string;
  readonly message: string;
}

export interface JoinState {
  readonly session: GuestSessionState;
  readonly name: string;
  readonly nameLabel: string;
  readonly setName: (value: string) => void;
  readonly nameError: JoinFailure | string | null;
  readonly failure: JoinFailure | null;
  readonly pending: boolean;
  readonly submit: () => Promise<void>;
}

function nameFromFragment(): string {
  return new URLSearchParams(window.location.hash.slice(1)).get("name") ?? "";
}

function guestAddress(): string {
  const base = basePath();
  return base === "/" ? "/guest" : `${base}/guest`;
}

function failureOf(error: ApiError): JoinFailure {
  const code = error.status === 0 || error.detail === "" ? error.code : error.detail;
  return { code, message: error.message };
}

export function useJoin(token: string): JoinState {
  const session = useGuestSession(false);
  const { store } = session;
  const [fragmentName] = useState(nameFromFragment);
  const [name, setNameValue] = useState(fragmentName);
  const [nameError, setNameError] = useState<JoinFailure | string | null>(null);
  const [failure, setFailure] = useState<JoinFailure | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    window.history.replaceState(window.history.state, "", guestAddress());
  }, []);

  const setName = useCallback((value: string) => {
    setNameValue(value);
    setNameError(null);
    setFailure(null);
  }, []);

  const submit = useCallback(async () => {
    const trimmed = name.trim().normalize("NFC");
    if (trimmed === "" || trimmed.length > NAME_MAX_CHARACTERS) {
      setNameError(NAME_REQUIRED);
      return;
    }
    setPending(true);
    setNameError(null);
    setFailure(null);
    try {
      store(await joinInvite({ invite_token: token, name: trimmed }, defaultBaseUrl()));
    } catch (cause) {
      if (!isApiError(cause)) throw cause;
      if (cause.detail === NAME_INVALID) setNameError(failureOf(cause));
      else setFailure(failureOf(cause));
    } finally {
      setPending(false);
    }
  }, [name, token, store]);

  const nameLabel = fragmentName.trim() === "" ? NAME_LABEL : NAME_LABEL_PREFILLED;

  return { session, name, nameLabel, setName, nameError, failure, pending, submit };
}
