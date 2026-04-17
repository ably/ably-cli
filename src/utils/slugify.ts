/**
 * Convert an account name to a valid alias slug.
 * Rules: lowercase, alphanumeric + dashes, must start with a letter.
 */
export function slugifyAccountName(name: string): string {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z\d]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  if (!slug) {
    return "default";
  }
  if (!/^[a-z]/.test(slug)) {
    return `account-${slug}`;
  }
  return slug;
}

/**
 * Resolve a non-colliding alias for an OAuth account.
 *
 * Two distinct accounts whose names slugify to the same string would
 * otherwise overwrite each other silently (e.g. "Acme Prod" and "Acme-Prod"
 * both slugify to "acme-prod"). Re-logging into the *same* account (same
 * accountId) is treated as a legitimate refresh and reuses the base alias.
 *
 * Returns the base alias when safe, or an auto-suffixed variant
 * (`base-2`, `base-3`, ...) when a different account already owns the base.
 */
export function pickUniqueAlias(
  desiredBase: string,
  targetAccountId: string,
  existingAccounts: { account: { accountId?: string }; alias: string }[],
): { alias: string; collidedWith?: { accountId?: string; alias: string } } {
  const existing = existingAccounts.find((a) => a.alias === desiredBase);
  if (!existing || existing.account.accountId === targetAccountId) {
    return { alias: desiredBase };
  }

  const aliases = new Set(existingAccounts.map((a) => a.alias));
  let suffix = 2;
  while (aliases.has(`${desiredBase}-${suffix}`)) {
    suffix++;
  }
  return {
    alias: `${desiredBase}-${suffix}`,
    collidedWith: {
      accountId: existing.account.accountId,
      alias: desiredBase,
    },
  };
}
