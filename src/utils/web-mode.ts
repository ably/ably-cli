// isWebCliMode checks if we're running on the terminal server / web CLI
const isWebCliMode = (): boolean => process.env.ABLY_WEB_CLI_MODE === "true";

export default isWebCliMode;
