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

export interface PaginationNext {
  hint: string;
  start?: string;
}

/**
 * Build a `next` object for JSON output when `hasMore` is true.
 * For history commands, pass `lastTimestamp` to include a `start` value
 * that users can pass to `--start` to continue from where they left off.
 */
export function buildPaginationNext(
  hasMore: boolean,
  lastTimestamp?: Date | number,
): PaginationNext | undefined {
  if (!hasMore) return undefined;

  const next: PaginationNext = {
    hint: "Increase --limit to fetch more results",
  };

  if (lastTimestamp !== undefined) {
    const ts =
      lastTimestamp instanceof Date
        ? lastTimestamp.toISOString()
        : new Date(lastTimestamp).toISOString();
    next.start = ts;
    next.hint = `Use --start "${ts}" to continue from where this result set ended, or increase --limit`;
  }

  return next;
}

/**
 * Returns a pagination message when multiple pages were fetched, or empty string if only one page.
 * When isBillable is true, returns a warning with billing note; otherwise returns a plain info line.
 */
export function formatPaginationLog(
  pagesConsumed: number,
  itemCount: number,
  isBillable = false,
): string {
  if (pagesConsumed <= 1) return "";
  const message = `Fetched ${pagesConsumed} pages to retrieve ${itemCount} results.`;
  if (isBillable) {
    return formatWarning(
      `${message} Each page request counts as a billable message.`,
    );
  }

  return message;
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
    hasMore,
    pagesConsumed,
  };
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

    if (
      items.length >= limit ||
      !currentPage.hasNext() ||
      pagesConsumed >= maxPages
    )
      break;
    currentPage = await currentPage.next();
  }

  const hasMore =
    items.length > limit || (currentPage !== null && currentPage.hasNext());
  const truncated = items.slice(0, limit);

  return {
    items: truncated,
    hasMore,
    pagesConsumed,
  };
}
