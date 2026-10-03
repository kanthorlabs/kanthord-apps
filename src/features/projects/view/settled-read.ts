import type { ApiError } from "@/api/errors";
import { readBinding } from "@/api/resources/projects";
import type { ProjectBindingRecord } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export type SettledRead<T> =
  { readonly data: T; readonly error: null } | { readonly data: null; readonly error: ApiError };

export async function settle<T>(read: Promise<T>): Promise<SettledRead<T>> {
  try {
    return { data: await read, error: null };
  } catch (cause: unknown) {
    return { data: null, error: asApiError(cause) };
  }
}

export type BindingReads = ReadonlyMap<string, SettledRead<ProjectBindingRecord>>;

export async function readBindings(
  projectId: string,
  bindingIds: readonly string[],
): Promise<BindingReads> {
  const unique = [...new Set(bindingIds)];
  const reads = await Promise.all(unique.map((id) => settle(readBinding(projectId, id))));
  return new Map(
    unique.map((id, index) => [id, reads[index] as SettledRead<ProjectBindingRecord>]),
  );
}
