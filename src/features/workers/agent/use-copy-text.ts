import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const COPIED_MS = 2000;

export function useCopyText(
  text: string,
  label: string,
): {
  readonly copied: boolean;
  readonly copy: () => void;
} {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        toast.success(`Copied the markdown of ${label}.`);
      },
      () => toast.error("The browser refused the clipboard."),
    );
  }, [text, label]);

  return { copied, copy };
}
