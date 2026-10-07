import { strToU8, zipSync } from "fflate";

import type { MissionImportSnapshot, MissionPlanEntry, MissionPlanFile } from "@/api/types";

export interface PickedFile {
  readonly name: string;
  readonly text: string;
}

export type ImportInput =
  | { readonly format: "json"; readonly entries: readonly MissionPlanEntry[] }
  | { readonly format: "markdown"; readonly files: readonly MissionPlanFile[] };

export type ImportInputResult =
  | { readonly ok: true; readonly input: ImportInput }
  | { readonly ok: false; readonly error: string };

const PICK_ERROR = "Pick one .json export, or one or more .md plan files.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function missionExportFilename(
  projectName: string,
  missionVersion: number,
  extension: "json" | "zip",
): string {
  return `${projectName}-mission-v${missionVersion}.${extension}`;
}

export function planArchive(files: readonly MissionPlanFile[]): Uint8Array<ArrayBuffer> {
  const archive = zipSync(
    Object.fromEntries(files.map((file) => [file.filename, strToU8(file.content)])),
  );
  return new Uint8Array(archive);
}

export function importInputOf(files: readonly PickedFile[]): ImportInputResult {
  if (files.length === 0) return { ok: false, error: PICK_ERROR };
  const [first] = files;
  if (files.length === 1 && first !== undefined && first.name.endsWith(".json")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(first.text);
    } catch {
      return { ok: false, error: `${first.name} is not valid JSON.` };
    }
    if (!isRecord(parsed) || !Array.isArray(parsed["entries"])) {
      return { ok: false, error: `${first.name} holds no "entries" array of a mission export.` };
    }
    return {
      ok: true,
      input: { format: "json", entries: parsed["entries"] as readonly MissionPlanEntry[] },
    };
  }
  if (files.every((file) => file.name.endsWith(".md"))) {
    return {
      ok: true,
      input: {
        format: "markdown",
        files: files.map((file) => ({ filename: file.name, content: file.text })),
      },
    };
  }
  return { ok: false, error: PICK_ERROR };
}

export function importSnapshotOf(
  input: ImportInput,
  missionId: string,
  missionVersion: number,
  reason: string,
): MissionImportSnapshot {
  const base = { mission_id: missionId, mission_version: missionVersion, reason };
  return input.format === "json"
    ? { ...base, format: "json", entries: input.entries }
    : { ...base, format: "markdown", files: input.files };
}

export function nodeNames(entries: readonly MissionPlanEntry[]): ReadonlyMap<string, string> {
  return new Map(
    entries.flatMap((entry): [string, string][] =>
      entry.id === undefined ? [] : [[entry.id, entry.name]],
    ),
  );
}
