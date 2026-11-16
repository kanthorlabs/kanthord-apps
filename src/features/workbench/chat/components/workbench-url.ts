import { basePath } from "@/components/base-path";

export function workbenchUrl(path: string): string {
  const base = basePath();
  return `${window.location.origin}${base === "/" ? "" : base}${path}`;
}

export function openWorkbenchUrl(url: string): void {
  window.open(url, "_blank");
}
