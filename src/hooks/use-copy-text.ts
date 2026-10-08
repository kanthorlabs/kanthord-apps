import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useClipboard } from "@/hooks/use-clipboard";

const COPIED_MS = 2000;

export function useCopyText(
  text: string,
  label: string,
): {
  readonly copied: boolean;
  readonly copy: () => void;
} {
  const [copied, setCopied] = useState(false);
  const write = useClipboard();

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(() => {
    write(text).then(
      () => {
        setCopied(true);
        toast.success(`Copied the markdown of ${label}.`);
      },
      () => toast.error("The browser refused the clipboard."),
    );
  }, [text, label, write]);

  return { copied, copy };
}
