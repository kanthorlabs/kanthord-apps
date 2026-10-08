import { useCallback } from "react";
import { toast } from "sonner";

import { useClipboard } from "@/hooks/use-clipboard";

export function useCopyCommand(command: string): () => void {
  const write = useClipboard();
  return useCallback(() => {
    write(command).then(
      () => toast.success("Copied the pi resume command."),
      () => toast.error("The browser refused the clipboard. Copy the command from the tooltip."),
    );
  }, [command, write]);
}
