import type { EnvironmentDocument } from "@/api/types";

export const ENVIRONMENT_NOT_OBJECT =
  "The environment is not a JSON object. Remove the comments and the trailing commas.";

export function parseEnvironmentDocument(text: string): EnvironmentDocument | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as EnvironmentDocument;
}
