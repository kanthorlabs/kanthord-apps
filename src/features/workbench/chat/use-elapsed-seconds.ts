import { useEffect, useState } from "react";

const TICK_MS = 1000;

export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - start) / TICK_MS)),
      TICK_MS,
    );
    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [active]);

  return active ? seconds : 0;
}
