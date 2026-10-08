import { useCallback } from "react";

function copyThroughSelection(text: string): void {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("The browser refused the clipboard.");
}

export function useClipboard(): (text: string) => Promise<void> {
  return useCallback(async (text: string) => {
    if (navigator.clipboard) return navigator.clipboard.writeText(text);
    copyThroughSelection(text);
  }, []);
}
