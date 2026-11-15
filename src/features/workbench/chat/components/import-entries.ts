export const IMPORT_APPLY_OPERATION_ID = "mission.import.apply";

export interface ImportEntryRow {
  readonly mark: "create" | "update";
  readonly kind: string;
  readonly filename: string;
  readonly name: string;
  readonly id: string | null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowOf(entry: unknown): ImportEntryRow | null {
  if (!isRecord(entry)) return null;
  const { id, intent, filename, name } = entry;
  if (typeof filename !== "string" || typeof name !== "string") return null;
  return {
    mark: id === undefined ? "create" : "update",
    kind: typeof intent === "string" ? intent : "task",
    filename,
    name,
    id: id === undefined ? null : String(id),
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
