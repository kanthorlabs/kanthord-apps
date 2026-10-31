import { useSyncExternalStore } from "react";

const STORAGE_KEY = "kd-board-shortcuts";

const SETTING = { On: "on", Off: "off" } as const;

const listeners = new Set<() => void>();

let unsaved: boolean | null = null;

function stored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== SETTING.Off;
  } catch {
    return true;
  }
}

function snapshot(): boolean {
  return unsaved ?? stored();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(enabled: boolean) {
  unsaved = null;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? SETTING.On : SETTING.Off);
  } catch {
    unsaved = enabled;
  }
  for (const listener of listeners) listener();
}

export interface ShortcutSetting {
  readonly enabled: boolean;
  readonly setEnabled: (enabled: boolean) => void;
}

export function useShortcutSetting(): ShortcutSetting {
  const enabled = useSyncExternalStore(subscribe, snapshot);
  return { enabled, setEnabled: write };
}
