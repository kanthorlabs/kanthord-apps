export interface Instance {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
}

export interface SavedInstance extends Instance {
  readonly token: string;
}

const STORAGE_KEY = "kanthord.instances";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isInstance(value: unknown): value is Instance {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["name"] === "string" &&
    typeof value["baseUrl"] === "string"
  );
}

function isSavedInstance(value: unknown): value is SavedInstance {
  return isInstance(value) && isRecord(value) && typeof value["token"] === "string";
}

function parseInstances(value: unknown): readonly SavedInstance[] {
  if (!isRecord(value) || !Array.isArray(value["instances"])) return [];
  return value["instances"].filter(isSavedInstance);
}

export function loadInstances(): readonly SavedInstance[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    return parseInstances(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveInstances(instances: readonly SavedInstance[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ instances }));
  } catch {
    return;
  }
}
