import open from "open";
import isTestMode from "./test-mode.js";
import isWebCliMode from "./web-mode.js";
import chalk from "chalk";

interface Logger {
  log: (msg: string) => void;
}

// openUrl opens a browser window if we're running normally, but just prints that it will if we're testing.
// In web CLI mode it prints "Visit <url>" instead of trying to open a browser.
// We don't want to open browsers in unit tests, and we can't use mocking to catch the calls because of how
// oclif loads the commands.
const openUrl = async (
  url: string,
  logger: Logger,
  isJsonOutput = false,
): Promise<void> => {
  if (isWebCliMode()) {
    if (isJsonOutput) {
      logger.log(JSON.stringify({ message: `Visit ${url}` }));
    } else {
      logger.log(`${chalk.cyan("Visit")} ${url}`);
    }
    return;
  }
  if (isJsonOutput) {
    logger.log(
      JSON.stringify({ message: `Opening ${url} in your browser...` }),
    );
  } else {
    logger.log(
      `${chalk.cyan("Opening")} ${url} ${chalk.cyan("in your browser")}...`,
    );
  }
  if (isTestMode()) {
    if (!isJsonOutput) {
      logger.log(`would open URL in browser: ${url}`);
    }
    return;
  }
  await open(url);
};

export default openUrl;
