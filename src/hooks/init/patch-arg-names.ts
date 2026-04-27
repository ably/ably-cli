import { Hook } from "@oclif/core";

import { camelToSnake } from "../../help.js";

/**
 * oclif init hook (registered in package.json under oclif.hooks.init).
 * Runs on every CLI invocation after loading the manifest, before command execution.
 *
 * Converts camelCase arg names to snake_case on config.commands metadata
 * (e.g., keyName → key_name) so oclif renders UPPER_SNAKE_CASE in USAGE and
 * ARGUMENTS sections. This covers missing-arg error output and doc generation
 * (`pnpm generate-doc`), both of which use the base Help class and bypass our
 * CustomHelp. CustomHelp.formatCommand() applies the same idempotent transform
 * for the --help path.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- oclif Hook type requires async
const hook: Hook<"init"> = async function ({ config }) {
  for (const command of config.commands) {
    for (const arg of Object.values(command.args)) {
      arg.name = camelToSnake(arg.name);
    }
  }
};

export default hook;
