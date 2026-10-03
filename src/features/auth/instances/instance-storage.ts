export interface Instance {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
}

export interface InstanceStore {
  readonly instances: readonly Instance[];
  readonly defaultId: string | null;
}

const STORAGE_KEY = "kanthord.instances";

const EMPTY_STORE: InstanceStore = { instances: [], defaultId: null };

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

function parseStore(value: unknown): InstanceStore {
  if (!isRecord(value) || !Array.isArray(value["instances"])) return EMPTY_STORE;
  const instances = value["instances"].filter(isInstance);
  const defaultId = value["defaultId"];
  const hasDefault =
    typeof defaultId === "string" && instances.some((instance) => instance.id === defaultId);
  return { instances, defaultId: hasDefault ? defaultId : null };
}

export function loadInstanceStore(): InstanceStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return EMPTY_STORE;
    return parseStore(JSON.parse(raw));
  } catch {
    return EMPTY_STORE;
  }
}

export function saveInstanceStore(store: InstanceStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    return;
  }
}
