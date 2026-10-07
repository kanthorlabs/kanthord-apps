import { request } from "./client";
import { ApiError } from "./errors";
import type { Page } from "./types";

export const PAGE_LIMIT = 1000;
export const PAGE_BUDGET = 50;

export async function readAllPages<T>(
  path: string,
  query: Readonly<Record<string, string>> = {},
): Promise<readonly T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let pages = 0; pages < PAGE_BUDGET; pages += 1) {
    const params = new URLSearchParams({ ...query, limit: String(PAGE_LIMIT) });
    if (cursor !== null) params.set("cursor", cursor);
    const page: Page<T> = await request<Page<T>>(`${path}?${params}`);
    items.push(...page.items);
    if (page.next_cursor === null) return items;
    if (seen.has(page.next_cursor)) {
      throw new ApiError("malformed", "The daemon repeated a page cursor.", 0, path);
    }
    seen.add(page.next_cursor);
    cursor = page.next_cursor;
  }
  throw new ApiError(
    "malformed",
    `The list holds more than ${PAGE_BUDGET * PAGE_LIMIT} records.`,
    0,
    path,
  );
}
