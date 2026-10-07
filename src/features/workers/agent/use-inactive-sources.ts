import { useCallback, useState } from "react";

import type { PromptLayer, PromptLayerKind, PromptSource } from "@/api/types";
import { isInactiveSource, sourceKey } from "@/lib/prompt-visibility";

const STORAGE_KEY = "kanthord.agent.show-inactive-sources";

export interface InactiveSourcesState {
  readonly show: boolean;
  readonly available: boolean;
  readonly setShow: (show: boolean) => void;
  readonly hides: (layer: PromptLayerKind, source: PromptSource) => boolean;
}

function loadShow(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveShow(show: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(show));
  } catch {
    return;
  }
}

function activeKeys(layers: readonly PromptLayer[]): readonly string[] {
  return layers.flatMap((layer) =>
    layer.sources
      .filter((source) => !isInactiveSource(source))
      .map((source) => sourceKey(layer.layer, source)),
  );
}

export function useInactiveSources(layers: readonly PromptLayer[]): InactiveSourcesState {
  const [show, setShowState] = useState(loadShow);
  const active = activeKeys(layers);
  const activeKey = active.join(" ");
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(active));
  const [seenKey, setSeenKey] = useState(activeKey);

  if (seenKey !== activeKey) {
    setSeenKey(activeKey);
    setSeen(new Set([...seen, ...active]));
  }

  const setShow = useCallback((next: boolean) => {
    setShowState(next);
    saveShow(next);
  }, []);

  const hides = useCallback(
    (layer: PromptLayerKind, source: PromptSource) =>
      !show && isInactiveSource(source) && !seen.has(sourceKey(layer, source)),
    [show, seen],
  );

  const available = layers.some((layer) => layer.sources.some(isInactiveSource));

  return { show, available, setShow, hides };
}
