/**
 * Shared validation utilities for annotation commands.
 *
 * Annotation type strings follow the format "namespace:summarization.version"
 * (e.g., "reactions:flag.v1"). The summarization method determines which
 * additional parameters are required.
 */

/** Summarization types that require a `name` parameter */
const NAME_REQUIRED_TYPES = new Set(["distinct", "unique", "multiple"]);

/** Summarization types that require a `count` parameter */
const COUNT_REQUIRED_TYPES = new Set(["multiple"]);

/**
 * Extract the summarization method from an annotation type string.
 * Format: "namespace:summarization.version" → returns "summarization"
 *
 * @example
 * extractSummarizationType("reactions:flag.v1") // "flag"
 * extractSummarizationType("emoji:distinct.v1") // "distinct"
 */
export function extractSummarizationType(annotationType: string): string {
  const colonIndex = annotationType.indexOf(":");
  if (colonIndex === -1) {
    throw new Error(
      'Invalid annotation type format. Expected "namespace:summarization.version" (e.g., "reactions:flag.v1")',
    );
  }

  const summarizationPart = annotationType.slice(colonIndex + 1);
  const dotIndex = summarizationPart.indexOf(".");
  if (dotIndex === -1) {
    throw new Error(
      'Invalid annotation type format. Expected "namespace:summarization.version" (e.g., "reactions:flag.v1")',
    );
  }

  return summarizationPart.slice(0, dotIndex);
}

/**
 * Validate that the required parameters are present for the given summarization type.
 *
 * @param summarization - The summarization method (e.g., "flag", "distinct", "multiple")
 * @param options - The parameters to validate
 * @returns An array of error messages (empty if valid)
 */
export function validateAnnotationParams(
  summarization: string,
  options: { name?: string; count?: number; isDelete?: boolean },
): string[] {
  const errors: string[] = [];

  if (NAME_REQUIRED_TYPES.has(summarization) && !options.name) {
    errors.push(`--name is required for "${summarization}" annotation types`);
  }

  // count is only required for publish, not delete
  if (
    !options.isDelete &&
    COUNT_REQUIRED_TYPES.has(summarization) &&
    options.count === undefined
  ) {
    errors.push(`--count is required for "${summarization}" annotation types`);
  }

  return errors;
}
