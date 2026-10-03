import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/api/errors";

export interface Resource<T> {
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly loading: boolean;
  readonly reload: () => void;
}

interface State<T> {
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly loading: boolean;
}

export function asApiError(cause: unknown): ApiError {
  return cause instanceof ApiError
    ? cause
    : new ApiError("malformed", "The response could not be read.", 0);
}

/**
 * Reads one api resource. ApiError is the only error type that crosses the
 * boundary, so a screen renders `error.message` without mapping a status.
 */
export function useResource<T>(read: () => Promise<T>, deps: readonly unknown[]): Resource<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const readRef = useRef(read);
  const key = JSON.stringify(deps);

  useEffect(() => {
    readRef.current = read;
  });

  useEffect(() => {
    let live = true;
    readRef.current().then(
      (value) => {
        if (live) setState({ data: value, error: null, loading: false });
      },
      (cause: unknown) => {
        if (live) setState({ data: null, error: asApiError(cause), loading: false });
      },
    );
    return () => {
      live = false;
    };
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data: state.data, error: state.error, loading: state.loading, reload };
}
