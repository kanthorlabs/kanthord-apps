import { useCallback, useRef } from "react";

interface Cancellable {
  readonly cancel: () => void;
}

export interface CancelMark {
  readonly track: <T extends Cancellable>(state: T) => T;
  readonly reset: () => void;
  readonly take: () => boolean;
}

export function useCancelMark(): CancelMark {
  const cancelled = useRef(false);
  const track = useCallback(
    <T extends Cancellable>(state: T): T => ({
      ...state,
      cancel: () => {
        cancelled.current = true;
        state.cancel();
      },
    }),
    [],
  );
  const reset = useCallback(() => {
    cancelled.current = false;
  }, []);
  const take = useCallback(() => {
    const was = cancelled.current;
    cancelled.current = false;
    return was;
  }, []);
  return { track, reset, take };
}
