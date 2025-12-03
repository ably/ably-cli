import open from "open";
import isTestMode from "./test-mode.js";
import chalk from "chalk";

interface Logger {
  log: (msg: string) => void;
}

// openUrl opens a browser window if we're running normally, but just prints that it will if we're testing
// we don't want to open browsers in unit tests, and we can't use mocking to catch the calls because of how
// oclif loads the commands.
const openUrl = async (url: string, logger: Logger): Promise<void> => {
  logger.log(
    `${chalk.cyan("Opening")} ${url} ${chalk.cyan("in your browser")}...`,
  );
  if (isTestMode()) {
    logger.log(`would open URL in browser: ${url}`);
    return;
  }
  await open(url);
};

export default openUrl;
