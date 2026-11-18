import { useEffect, useState } from "react";

const TICK_MS = 1000;

export function useNow(active: boolean, tickMs = TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [active, tickMs]);
  return now;
}
