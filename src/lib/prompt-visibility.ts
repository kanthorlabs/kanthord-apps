import type { PromptLayerKind, PromptSource } from "@/api/types";

const CUSTOM_SOURCE = "custom";

export function isInactiveSource(source: PromptSource): boolean {
  return (source.state === "absent" || source.state === "off") && source.source !== CUSTOM_SOURCE;
}

export function sourceKey(layer: PromptLayerKind, source: PromptSource): string {
  return `${layer}:${source.source}`;
}

export function hiddenSourcesLabel(count: number): string {
  return `${count} inactive ${count === 1 ? "source" : "sources"} hidden`;
}
