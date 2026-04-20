import { Hook } from "@oclif/core";

import { camelToSnake } from "../../help.js";

/**
 * When generating docs (GENERATING_DOC=true), patch camelCase arg names to
 * snake_case so oclif's toUpperCase() produces UPPER_SNAKE_CASE in headings/TOC.
 *
 * This complements the same patch in CustomHelp.formatCommand() (src/help.ts),
 * which only covers the help body. The readme generator's commandUsage() has its
 * own toUpperCase() call that runs before formatCommand, so we patch here — in
 * the init hook — to cover all code paths.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- oclif Hook type requires async
const hook: Hook<"init"> = async function ({ config }) {
  if (process.env.GENERATING_DOC !== "true") return;

  for (const command of config.commands) {
    for (const arg of Object.values(command.args)) {
      arg.name = camelToSnake(arg.name);
    }
  }
};

export default hook;
