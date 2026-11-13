import { useEffect, useRef } from "react";

export function useDialogClosed(open: boolean, onClosed: () => void): void {
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open) onClosed();
    wasOpen.current = open;
  });
}
