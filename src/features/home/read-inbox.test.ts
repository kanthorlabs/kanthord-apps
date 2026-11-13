import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/mission", () => ({ listInboxItems: vi.fn() }));

import { listInboxItems } from "@/api/resources/mission";
import type { InboxItem } from "@/api/types";

import { readInboxScope } from "./read-inbox";

const PAGES = 150;

function pageOf(index: number, next: string | null) {
  return {
    items: [{ link_update_id: `link_${index}` } as InboxItem],
    next_cursor: next,
    counts: { open: PAGES, snoozed: 0, done: 0 },
  };
}

beforeEach(() => {
  vi.mocked(listInboxItems).mockReset();
});

describe("readInboxScope", () => {
  it("reads every page until the cursor ends", async () => {
    vi.mocked(listInboxItems).mockImplementation(async ({ cursor }) => {
      const index = cursor === null ? 0 : Number(cursor);
      return pageOf(index, index + 1 < PAGES ? String(index + 1) : null);
    });

    const scope = await readInboxScope(null);

    expect(scope.items).toHaveLength(PAGES);
    expect(scope.open).toBe(PAGES);
    expect(listInboxItems).toHaveBeenCalledTimes(PAGES);
  });

  it("rejects a read whose cursor repeats", async () => {
    vi.mocked(listInboxItems).mockImplementation(async () => pageOf(0, "same"));

    await expect(readInboxScope(null)).rejects.toThrow("the same cursor twice");
  });
});
