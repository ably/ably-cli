/**
 * Extract the summarization method from an annotation type string.
 * Format: "namespace:summarization.version" -> returns "summarization"
 *
 * The Ably SDK does not validate annotation type format client-side.
 * This provides early CLI-level feedback for obvious format errors.
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
 * Summarization types that require a `name` parameter.
 * Per Ably docs: "In the case of the distinct, unique, or multiple
 * aggregation types, you should also specify a name."
 */
const NAME_REQUIRED_TYPES = new Set(["distinct", "unique", "multiple"]);

/**
 * Validate required parameters for the given summarization type.
 * Unknown types pass through without validation (forward compatibility).
 *
 * NOTE: `count` is NOT validated as required for any type.
 * Per Ably docs, count on multiple.v1 "defaults to incrementing by 1"
 * if not specified. It is always optional.
 *
 * The Ably SDK performs no client-side field validation — all requirements
 * are enforced server-side. This provides early, human-readable errors.
 */
export function validateAnnotationParams(
  summarization: string,
  options: { name?: string },
): string[] {
  const errors: string[] = [];

  if (NAME_REQUIRED_TYPES.has(summarization) && !options.name) {
    errors.push(`--name is required for "${summarization}" annotation types`);
  }

  return errors;
}
