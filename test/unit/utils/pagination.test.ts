import { describe, expect, it, vi } from "vitest";

import {
  collectPaginatedResults,
  collectFilteredPaginatedResults,
} from "../../../src/utils/pagination.js";

function createMockPage<T>(
  items: T[],
  nextPage?: {
    items: T[];
    hasNext?: boolean;
    nextPage?: { items: T[]; hasNext?: boolean };
  },
) {
  return {
    items,
    hasNext: () => !!nextPage,
    next: async () => {
      if (!nextPage) return null;
      return createMockPage(
        nextPage.items,
        nextPage.nextPage
          ? {
              items: nextPage.nextPage.items,
              hasNext: nextPage.nextPage.hasNext,
            }
          : undefined,
      );
    },
  };
}

describe("collectPaginatedResults", () => {
  it("should return all items when single page fits within limit", async () => {
    const page = createMockPage([1, 2, 3]);
    const result = await collectPaginatedResults(page, 10);

    expect(result.items).toEqual([1, 2, 3]);
    expect(result.hasMore).toBe(false);
    expect(result.pagesConsumed).toBe(1);
  });

  it("should collect multiple pages to fill limit", async () => {
    const page = createMockPage([1, 2], {
      items: [3, 4],
      hasNext: false,
    });
    const result = await collectPaginatedResults(page, 10);

    expect(result.items).toEqual([1, 2, 3, 4]);
    expect(result.hasMore).toBe(false);
    expect(result.pagesConsumed).toBe(2);
  });

  it("should stop at limit and report hasMore: true", async () => {
    const page = createMockPage([1, 2, 3], {
      items: [4, 5, 6],
      hasNext: true,
      nextPage: { items: [7, 8, 9], hasNext: false },
    });
    const result = await collectPaginatedResults(page, 5);

    expect(result.items).toEqual([1, 2, 3, 4, 5]);
    expect(result.hasMore).toBe(true);
    expect(result.pagesConsumed).toBe(2);
  });

  it("should handle empty first page", async () => {
    const page = createMockPage([]);
    const result = await collectPaginatedResults(page, 10);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.pagesConsumed).toBe(1);
  });

  it("should handle next() returning null early", async () => {
    const page = {
      items: [1, 2],
      hasNext: () => true,
      next: async () => null,
    };
    const result = await collectPaginatedResults(page, 10);

    expect(result.items).toEqual([1, 2]);
    expect(result.hasMore).toBe(false);
    expect(result.pagesConsumed).toBe(1);
  });

  it("should propagate errors from next()", async () => {
    const page = {
      items: [1, 2],
      hasNext: () => true,
      next: async () => {
        throw new Error("Network error");
      },
    };

    await expect(collectPaginatedResults(page, 10)).rejects.toThrow(
      "Network error",
    );
  });

  it("should report hasMore false when items exactly equal limit with no more pages", async () => {
    const page = createMockPage([1, 2, 3]);
    // hasNext returns false, so even though items.length === limit, hasMore is false
    const result = await collectPaginatedResults(page, 3);

    expect(result.items).toEqual([1, 2, 3]);
    expect(result.hasMore).toBe(false);
    expect(result.pagesConsumed).toBe(1);
  });

  it("should throw when limit is zero", async () => {
    const page = createMockPage([1, 2, 3]);
    await expect(collectPaginatedResults(page, 0)).rejects.toThrow(
      "Pagination limit must be a positive integer.",
    );
  });

  it("should throw when limit is negative", async () => {
    const page = createMockPage([1, 2, 3]);
    await expect(collectPaginatedResults(page, -1)).rejects.toThrow(
      "Pagination limit must be a positive integer.",
    );
  });

  it("should throw when limit is not an integer", async () => {
    const page = createMockPage([1, 2, 3]);
    await expect(collectPaginatedResults(page, 1.5)).rejects.toThrow(
      "Pagination limit must be a positive integer.",
    );
  });

  it("should report hasMore when items exactly equal limit and page has next", async () => {
    const page = {
      items: [1, 2, 3],
      hasNext: () => true,
      next: async () => createMockPage([4, 5]),
    };
    const result = await collectPaginatedResults(page, 3);

    expect(result.items).toEqual([1, 2, 3]);
    expect(result.hasMore).toBe(true);
    expect(result.pagesConsumed).toBe(1);
  });
});

describe("collectFilteredPaginatedResults", () => {
  it("should filter items across pages", async () => {
    const page = createMockPage([1, 2, 3, 4, 5], {
      items: [6, 7, 8, 9, 10],
      hasNext: false,
    });
    const result = await collectFilteredPaginatedResults(
      page,
      3,
      (n) => n % 2 === 0,
    );

    expect(result.items).toEqual([2, 4, 6]);
    expect(result.hasMore).toBe(true);
    expect(result.pagesConsumed).toBe(2);
  });

  it("should respect maxPages safety cap", async () => {
    // Create a chain of pages that never ends effectively
    let callCount = 0;
    const createInfinitePage = (): ReturnType<
      typeof createMockPage<number>
    > => ({
      items: [callCount++],
      hasNext: () => true,
      next: async () => createInfinitePage(),
    });

    const result = await collectFilteredPaginatedResults(
      createInfinitePage(),
      1000,
      () => true,
      3,
    );

    expect(result.pagesConsumed).toBe(3);
    expect(result.hasMore).toBe(true);
  });

  it("should throw when limit is zero", async () => {
    const page = createMockPage([1, 2, 3]);
    await expect(
      collectFilteredPaginatedResults(page, 0, () => true),
    ).rejects.toThrow("Pagination limit must be a positive integer.");
  });

  it("should report hasMore false when maxPages reached but no more pages exist", async () => {
    // Only 2 pages exist, maxPages is 2 — should NOT report hasMore
    const page = createMockPage([1, 2], {
      items: [3, 4],
      hasNext: false,
    });
    const result = await collectFilteredPaginatedResults(
      page,
      100,
      () => true,
      2,
    );

    expect(result.items).toEqual([1, 2, 3, 4]);
    expect(result.hasMore).toBe(false);
    expect(result.pagesConsumed).toBe(2);
  });

  it("should propagate errors from next()", async () => {
    const page = {
      items: [1, 2],
      hasNext: () => true,
      next: async () => {
        throw new Error("Network failure");
      },
    };

    await expect(
      collectFilteredPaginatedResults(page, 10, () => true),
    ).rejects.toThrow("Network failure");
  });

  it("should not fetch a page it will not process when maxPages is reached", async () => {
    const page3Next = vi.fn();
    const page2 = {
      items: [5, 6, 7],
      hasNext: () => true,
      next: page3Next,
    };
    const page1 = {
      items: [1, 2, 3, 4],
      hasNext: () => true,
      next: async () => page2,
    };

    // maxPages=2, limit=100, filter passes even numbers only
    const result = await collectFilteredPaginatedResults(
      page1,
      100,
      (n) => n % 2 === 0,
      2,
    );

    // Should process page1 and page2 (2 pages), but NOT fetch page3
    expect(result.pagesConsumed).toBe(2);
    expect(result.items).toEqual([2, 4, 6]);
    expect(result.hasMore).toBe(true); // page2 has next
    expect(page3Next).not.toHaveBeenCalled();
  });

  it("should return empty when no items match filter", async () => {
    const page = createMockPage([1, 3, 5]);
    const result = await collectFilteredPaginatedResults(
      page,
      10,
      (n) => n % 2 === 0,
    );

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.pagesConsumed).toBe(1);
  });
});
