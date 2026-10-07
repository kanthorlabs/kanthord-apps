import type { PromptLayerKind, PromptScope, PromptSource, SystemLayerOverride } from "@/api/types";

export const SYSTEM_LAYER_SWITCH = "layer";

const LAYER_SCOPES: Readonly<Record<PromptLayerKind, PromptScope>> = {
  system: "system",
  agent: "agent",
  working: "workbench",
};

export const OVERRIDE_LABELS: Readonly<Record<SystemLayerOverride, string>> = {
  inherit: "Follow server",
  on: "On",
  off: "Off",
};

export function scopeOfLayer(layer: PromptLayerKind): PromptScope {
  return LAYER_SCOPES[layer];
}

export function isLastSourceOn(
  switches: Readonly<Record<string, boolean>>,
  source: string,
): boolean {
  const on = Object.entries(switches).filter(([, enabled]) => enabled);
  return on.length === 1 && on[0]?.[0] === source;
}

export function overrideOf(value: string | undefined): SystemLayerOverride | null {
  return value === "inherit" || value === "on" || value === "off" ? value : null;
}

export function systemLayerSummary(
  override: SystemLayerOverride,
  serverOn: boolean,
  agentName: string,
): string {
  const server = serverOn ? "on" : "off";
  if (override === "inherit") return `Follows the server switch, which is ${server}.`;
  return `Turned ${override} for ${agentName} only. The server switch is ${server}.`;
}

const LAST_SOURCE_REASON = "The agent layer needs one source that is on.";

export function sourceLockReason(
  layer: PromptLayerKind,
  source: PromptSource,
  title: string,
  switches: Readonly<Record<string, boolean>>,
): string | null {
  if (source.origin === "file" && source.state === "absent") return `${title} does not exist.`;
  if (layer === "agent" && isLastSourceOn(switches, source.source)) return LAST_SOURCE_REASON;
  return null;
}
