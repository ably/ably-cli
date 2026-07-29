import { input, password } from "@inquirer/prompts";

const requireNonEmpty = (value: string) =>
  value.trim().length > 0 || "A value is required";

/**
 * Prompt for a free-text value, re-asking until a non-empty answer is given.
 *
 * @param message - Label shown before the input
 * @param options.defaultValue - Returned when the user submits an empty line
 * @param options.secret - Mask the input, for credentials that should not be
 *   echoed into terminal scrollback
 */
export async function promptForValue(
  message: string,
  options: { defaultValue?: string; secret?: boolean } = {},
): Promise<string> {
  if (options.secret) {
    const answer = await password({
      mask: true,
      message,
      validate: requireNonEmpty,
    });
    return answer.trim();
  }

  const answer = await input({
    default: options.defaultValue,
    message,
    validate: requireNonEmpty,
  });
  return answer.trim();
}
