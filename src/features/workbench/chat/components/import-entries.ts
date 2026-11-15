export const IMPORT_APPLY_OPERATION_ID = "mission.import.apply";

export interface ImportEntryRow {
  readonly mark: "create" | "update";
  readonly kind: "node" | "task";
  readonly intent: string | null;
  readonly filename: string;
  readonly name: string;
  readonly id: string | null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowOf(entry: unknown): ImportEntryRow | null {
  if (!isRecord(entry)) return null;
  const { id, intent, node, filename, name } = entry;
  if (typeof filename !== "string" || typeof name !== "string") return null;
  if (id !== undefined && typeof id !== "string") return null;
  return {
    mark: id === undefined ? "create" : "update",
    kind: typeof node === "string" ? "task" : "node",
    intent: typeof intent === "string" ? intent : null,
    filename,
    name,
    id: id ?? null,
  };
}

export function importEntryRowsOf(
  input: Readonly<Record<string, unknown>>,
): readonly ImportEntryRow[] | null {
  const body = input["body"];
  if (!isRecord(body) || !Array.isArray(body["entries"])) return null;
  const rows = body["entries"].map(rowOf);
  return rows.every((row) => row !== null) ? rows : null;
}
