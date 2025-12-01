// Helper function to tell if we're in test mode.
const isTestMode = (): boolean => process.env.ABLY_CLI_TEST_MODE === "true";

export default isTestMode;
