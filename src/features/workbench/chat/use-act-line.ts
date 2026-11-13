import { useEffect } from "react";

export function useActLine(line: string | null, onLine: (line: string) => void): void {
  useEffect(() => {
    if (line !== null) onLine(line);
  }, [line, onLine]);
}
