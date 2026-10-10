import type { PromptLayerKind, PromptScope, PromptSource, SystemLayerOverride } from "@/api/types";

export const SYSTEM_LAYER_SWITCH = "layer";

export const PROMPT_REVISION_CONFLICT_CODE = "agent.prompt.revision_conflict";

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

const LOCKED_SWITCH_REASONS: Readonly<Record<string, string>> = {
  host_file: "kanthord.yaml turns the host agent file off.",
};

export function lockedSwitchReason(lockedSwitches: readonly string[], name: string): string | null {
  return lockedSwitches.includes(name) ? (LOCKED_SWITCH_REASONS[name] ?? null) : null;
}

export type SourceLock = "absent-file" | "last-source";

export function sourceLockOf(
  layer: PromptLayerKind,
  source: PromptSource,
  switches: Readonly<Record<string, boolean>>,
): SourceLock | null {
  if (source.origin === "file" && source.state === "absent") return "absent-file";
  if (layer === "agent" && isLastSourceOn(switches, source.source)) return "last-source";
  return null;
}
