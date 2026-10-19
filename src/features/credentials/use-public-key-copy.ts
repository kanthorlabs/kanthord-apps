import { useCallback } from "react";
import { toast } from "sonner";

import { useClipboard } from "@/hooks/use-clipboard";

export function usePublicKeyCopy(): (publicKey: string) => void {
  const write = useClipboard();
  return useCallback(
    (publicKey: string) => {
      write(publicKey).then(
        () => toast.success("Copied the public key."),
        () => toast.error("The browser refused the clipboard. Select the key and copy it."),
      );
    },
    [write],
  );
}
