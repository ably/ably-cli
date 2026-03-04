/**
 * Convert an account name to a valid alias slug.
 * Rules: lowercase, alphanumeric + dashes, must start with a letter.
 */
export function slugifyAccountName(name: string): string {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z\d]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  if (!slug || !/^[a-z]/.test(slug)) {
    return "default";
  }
  return slug;
}
