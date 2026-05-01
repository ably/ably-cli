import chalk from "chalk";

/**
 * Format JSON data with syntax highlighting for console output
 * @param data Any data that can be serialized to JSON
 * @returns A colored string representation of the JSON data
 */
export function formatJson(data: unknown): string {
  if (data === undefined) return chalk.gray("undefined");
  if (data === null) return chalk.gray("null");

  try {
    // For non-object/non-array simple values, don't do full JSON formatting
    if (typeof data !== "object") {
      return colorValue(data);
    }

    // For objects and arrays, do pretty printing with color
    const jsonString = JSON.stringify(data, null, 2);
    return colorizeJson(jsonString);
  } catch {
    // If JSON serialization fails (e.g. circular reference), return a safe string representation
    if (typeof data !== "object") {
      if (typeof data === "string") return data;
      if (typeof data === "number" || typeof data === "boolean")
        return String(data);
      return "[non-serializable]";
    }

    try {
      return JSON.stringify(data);
    } catch {
      return "[Circular]";
    }
  }
}

/**
 * Format message data for display: uses colorized JSON for objects, String() for primitives.
 */
export function formatMessageData(data: unknown): string {
  return isJsonData(data) ? formatJson(data) : String(data);
}

/**
 * Determine if data is likely to be JSON
 * @param data The data to check
 * @returns True if the data is a JSON object or array
 */
export function isJsonData(data: unknown): boolean {
  if (data === null || data === undefined) return false;

  if (typeof data === "object") {
    return true;
  }

  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return typeof parsed === "object" && parsed !== null;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Color a JSON value based on its type
 * @param value The value to colorize
 * @returns Colorized string representation
 */
function colorValue(value: unknown): string {
  if (value === null) return chalk.gray("null");
  if (value === undefined) return chalk.gray("undefined");

  switch (typeof value) {
    case "number": {
      return chalk.yellow(value);
    }

    case "boolean": {
      return chalk.cyan(value);
    }

    case "string": {
      return chalk.green(`"${value}"`);
    }

    default: {
      if (typeof value === "object") return JSON.stringify(value);
      if (typeof value === "bigint" || typeof value === "symbol")
        return value.toString();
      return "[unprintable]";
    }
  }
}

/**
 * Add colors to a JSON string
 * @param jsonString JSON string to colorize
 * @returns Colorized JSON string
 */
function colorizeJson(jsonString: string): string {
  // Using replace with global flag for each pattern
  let result = jsonString;

  // Keys
  result = result.replaceAll(
    /"([^"]+)":/g,
    (_, key) => `${chalk.blue(`"${key}"`)}: `,
  );

  // String values
  result = result.replaceAll(
    /: "([^"]*)"/g,
    (_, value) => `: ${chalk.green(`"${value}"`)}`,
  );

  // Numbers
  result = result.replaceAll(
    /: (-?\d+\.?\d*)/g,
    (_, value) => `: ${chalk.yellow(value)}`,
  );

  // Booleans
  result = result.replaceAll(
    /: (true|false)/g,
    (_, value) => `: ${chalk.cyan(value)}`,
  );

  // null
  result = result.replaceAll(
    /: (null)/g,
    (_, value) => `: ${chalk.gray(value)}`,
  );

  return result;
}
