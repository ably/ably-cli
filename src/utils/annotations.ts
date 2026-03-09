/**
 * Extract the summarization method from an annotation type string.
 * Format: "namespace:summarization.version" → returns "summarization"
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

/** Summarization types that require a `name` parameter */
const NAME_REQUIRED_TYPES = new Set(["distinct", "unique", "multiple"]);

/** Summarization types that require a `count` parameter */
const COUNT_REQUIRED_TYPES = new Set(["multiple"]);

/**
 * Validate that the required parameters are present for the given summarization type.
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
