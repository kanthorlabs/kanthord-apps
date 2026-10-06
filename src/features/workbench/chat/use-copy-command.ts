import { useCallback } from "react";
import { toast } from "sonner";

export function useCopyCommand(command: string): () => void {
  return useCallback(() => {
    navigator.clipboard.writeText(command).then(
      () => toast.success("Copied the pi resume command."),
      () => toast.error("The browser refused the clipboard. Copy the command from the tooltip."),
    );
  }, [command]);
}
