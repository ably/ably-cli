/**
 * Generic pagination utilities for collecting results across multiple pages.
 *
 * Works with both Ably SDK PaginatedResult and Chat SDK PaginatedResult
 * (same interface: items, hasNext(), next()).
 */

import { formatWarning } from "./output.js";

export interface PaginationResult<T> {
  items: T[];
  hasMore: boolean;
  pagesConsumed: number;
}

/**
 * Returns a formatted warning when multiple pages were fetched, or empty string if only one page.
 */
export function formatPaginationWarning(
  pagesConsumed: number,
  itemCount: number,
): string {
  if (pagesConsumed <= 1) return "";
  return formatWarning(
    `Fetched ${pagesConsumed} pages to retrieve ${itemCount} results. Each result counts as a billable message.`,
  );
}

interface PaginatedPage<T> {
  items: T[];
  hasNext(): boolean;
  next(): Promise<PaginatedPage<T> | null>;
}

/**
 * Collect items from a paginated result until the limit is reached or no more pages.
 * Truncates to `limit` items and reports whether more data exists.
 */
export async function collectPaginatedResults<T>(
  firstPage: PaginatedPage<T>,
  limit: number,
): Promise<PaginationResult<T>> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Pagination limit must be a positive integer.");
  }

  const items: T[] = [...firstPage.items];
  let pagesConsumed = 1;

  let currentPage: PaginatedPage<T> = firstPage;

  while (items.length < limit && currentPage.hasNext()) {
    const nextPage = await currentPage.next();
    if (!nextPage) break;
    pagesConsumed++;
    items.push(...nextPage.items);
    currentPage = nextPage;
  }

  const hasMore =
    items.length > limit || (items.length >= limit && currentPage.hasNext());
  const truncated = items.slice(0, limit);

  return {
    items: truncated,
    hasMore: hasMore || truncated.length < items.length,
    pagesConsumed,
  };
}

/**
 * Collect items from an HttpPaginatedResponse until the limit is reached or no more pages.
 * Semantic alias for collectPaginatedResults — the underlying interface is identical,
 * but this signals that the caller is working with rest.request() results rather than
 * SDK PaginatedResult objects.
 */
export async function collectHttpPaginatedResults<T>(
  firstPage: PaginatedPage<T>,
  limit: number,
): Promise<PaginationResult<T>> {
  return collectPaginatedResults(firstPage, limit);
}

/**
 * Collect filtered items from paginated results. Keeps fetching pages until enough
 * items matching the filter are found, with a max-pages safety cap.
 */
export async function collectFilteredPaginatedResults<T>(
  firstPage: PaginatedPage<T>,
  limit: number,
  filter: (item: T) => boolean,
  maxPages = 20,
): Promise<PaginationResult<T>> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Pagination limit must be a positive integer.");
  }

  const items: T[] = [];
  let pagesConsumed = 0;
  let currentPage: PaginatedPage<T> | null = firstPage;

  while (currentPage && items.length < limit && pagesConsumed < maxPages) {
    pagesConsumed++;
    for (const item of currentPage.items) {
      if (filter(item)) {
        items.push(item);
      }
    }

    if (items.length >= limit || !currentPage.hasNext()) break;
    currentPage = await currentPage.next();
  }

  const hasMore =
    items.length > limit || (currentPage !== null && currentPage.hasNext());
  const truncated = items.slice(0, limit);

  return {
    items: truncated,
    hasMore: hasMore || truncated.length < items.length,
    pagesConsumed,
  };
}
