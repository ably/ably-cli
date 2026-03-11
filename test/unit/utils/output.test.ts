import { describe, it, expect } from "vitest";
import chalk from "chalk";
import {
  formatProgress,
  formatSuccess,
  formatListening,
  formatLabel,
  formatResource,
  formatTimestamp,
  formatClientId,
  formatEventType,
  formatHeading,
  formatIndex,
  formatCountLabel,
  formatLimitWarning,
  formatMessageTimestamp,
  formatPresenceAction,
  buildJsonRecord,
  formatWarning,
} from "../../../src/utils/output.js";

describe("formatProgress", () => {
  it("appends ... to the message", () => {
    expect(formatProgress("Loading")).toBe("Loading...");
  });

  it("works with an empty string", () => {
    expect(formatProgress("")).toBe("...");
  });
});

describe("formatSuccess", () => {
  it("prepends a green checkmark", () => {
    expect(formatSuccess("Done")).toBe(`${chalk.green("✓")} Done`);
  });

  it("includes the message text", () => {
    expect(formatSuccess("Published.")).toContain("Published.");
  });
});

describe("formatWarning", () => {
  it("prepends a yellow warning symbol", () => {
    expect(formatWarning("Something happened")).toBe(
      `${chalk.yellow("⚠")} Something happened`,
    );
  });

  it("includes the message text", () => {
    expect(formatWarning("Check this.")).toContain("Check this.");
  });
});

describe("formatListening", () => {
  it("includes the description text", () => {
    expect(formatListening("Listening for messages.")).toContain(
      "Listening for messages.",
    );
  });

  it('includes "Press Ctrl+C to exit."', () => {
    expect(formatListening("Listening.")).toContain("Press Ctrl+C to exit.");
  });

  it("wraps in dim styling", () => {
    expect(formatListening("Listening.")).toBe(
      chalk.dim("Listening. Press Ctrl+C to exit."),
    );
  });
});

describe("formatLabel", () => {
  it("appends a colon", () => {
    const result = formatLabel("Field Name");
    expect(result).toBe(chalk.dim("Field Name:"));
  });

  it("contains the label text", () => {
    expect(formatLabel("Status")).toContain("Status");
  });
});

describe("formatResource", () => {
  it("wraps the name in cyan", () => {
    expect(formatResource("my-channel")).toBe(chalk.cyan("my-channel"));
  });
});

describe("formatTimestamp", () => {
  it("wraps the timestamp in brackets", () => {
    const result = formatTimestamp("2025-01-01T00:00:00Z");
    expect(result).toBe(chalk.dim("[2025-01-01T00:00:00Z]"));
  });

  it("contains [ and ]", () => {
    const result = formatTimestamp("now");
    expect(result).toContain("[");
    expect(result).toContain("]");
  });
});

describe("formatClientId", () => {
  it("wraps the id in blue", () => {
    expect(formatClientId("user-123")).toBe(chalk.blue("user-123"));
  });
});

describe("formatEventType", () => {
  it("wraps the type in yellow", () => {
    expect(formatEventType("message")).toBe(chalk.yellow("message"));
  });
});

describe("formatHeading", () => {
  it("wraps the text in bold", () => {
    expect(formatHeading("Record ID: abc")).toBe(chalk.bold("Record ID: abc"));
  });
});

describe("formatIndex", () => {
  it("wraps the number in dim brackets", () => {
    expect(formatIndex(1)).toBe(chalk.dim("[1]"));
  });

  it("contains [ and ] around the number", () => {
    const result = formatIndex(42);
    expect(result).toContain("[");
    expect(result).toContain("42");
    expect(result).toContain("]");
  });
});

describe("formatCountLabel", () => {
  it("uses singular for count of 1", () => {
    const result = formatCountLabel(1, "message");
    expect(result).toBe(`${chalk.cyan("1")} message`);
  });

  it("auto-pluralizes by appending s for count != 1", () => {
    const result = formatCountLabel(3, "message");
    expect(result).toBe(`${chalk.cyan("3")} messages`);
  });

  it("auto-pluralizes for count of 0", () => {
    const result = formatCountLabel(0, "message");
    expect(result).toBe(`${chalk.cyan("0")} messages`);
  });

  it("uses custom plural when provided", () => {
    const result = formatCountLabel(2, "entry", "entries");
    expect(result).toBe(`${chalk.cyan("2")} entries`);
  });

  it("uses singular even with custom plural when count is 1", () => {
    const result = formatCountLabel(1, "entry", "entries");
    expect(result).toBe(`${chalk.cyan("1")} entry`);
  });
});

describe("formatLimitWarning", () => {
  it("returns null when count is under the limit", () => {
    expect(formatLimitWarning(5, 10, "items")).toBeNull();
  });

  it("returns a warning string when count equals the limit", () => {
    const result = formatLimitWarning(10, 10, "items");
    expect(result).not.toBeNull();
    expect(result).toBe(
      chalk.yellow("Showing maximum of 10 items. Use --limit to show more."),
    );
  });

  it("returns a warning string when count exceeds the limit", () => {
    const result = formatLimitWarning(15, 10, "records");
    expect(result).not.toBeNull();
    expect(result).toContain("10");
    expect(result).toContain("records");
  });
});

describe("formatMessageTimestamp", () => {
  it("converts a number (Unix ms) to an ISO string", () => {
    const ts = new Date("2025-06-15T12:00:00Z").getTime();
    expect(formatMessageTimestamp(ts)).toBe("2025-06-15T12:00:00.000Z");
  });

  it("handles Date objects", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    expect(formatMessageTimestamp(date)).toBe("2025-01-01T00:00:00.000Z");
  });

  it("falls back to current time for undefined", () => {
    const before = Date.now();
    const result = formatMessageTimestamp();
    const after = Date.now();
    const resultTime = new Date(result).getTime();
    expect(resultTime).toBeGreaterThanOrEqual(before);
    expect(resultTime).toBeLessThanOrEqual(after);
  });

  it("falls back to current time for null", () => {
    const before = Date.now();
    const result = formatMessageTimestamp(null);
    const after = Date.now();
    const resultTime = new Date(result).getTime();
    expect(resultTime).toBeGreaterThanOrEqual(before);
    expect(resultTime).toBeLessThanOrEqual(after);
  });

  it("handles timestamp of 0 (epoch)", () => {
    expect(formatMessageTimestamp(0)).toBe("1970-01-01T00:00:00.000Z");
  });
});

describe("formatPresenceAction", () => {
  it('returns green checkmark for "enter"', () => {
    const result = formatPresenceAction("enter");
    expect(result.symbol).toBe("✓");
    expect(result.color).toBe(chalk.green);
  });

  it('returns red cross for "leave"', () => {
    const result = formatPresenceAction("leave");
    expect(result.symbol).toBe("✗");
    expect(result.color).toBe(chalk.red);
  });

  it('returns yellow cycle symbol for "update"', () => {
    const result = formatPresenceAction("update");
    expect(result.symbol).toBe("⟲");
    expect(result.color).toBe(chalk.yellow);
  });

  it("returns white bullet for unknown actions", () => {
    const result = formatPresenceAction("something-else");
    expect(result.symbol).toBe("•");
    expect(result.color).toBe(chalk.white);
  });

  it("is case-insensitive", () => {
    expect(formatPresenceAction("ENTER").symbol).toBe("✓");
    expect(formatPresenceAction("Leave").symbol).toBe("✗");
    expect(formatPresenceAction("UPDATE").symbol).toBe("⟲");
  });
});

describe("buildJsonRecord", () => {
  it("adds type and command to all records", () => {
    const record = buildJsonRecord("event", "channels subscribe", {
      channel: "test",
    });
    expect(record.type).toBe("event");
    expect(record.command).toBe("channels subscribe");
    expect(record.channel).toBe("test");
  });

  it("adds success:true for result type", () => {
    const record = buildJsonRecord("result", "apps list", { total: 3 });
    expect(record.success).toBe(true);
    expect(record.total).toBe(3);
  });

  it("adds success:false for error type", () => {
    const record = buildJsonRecord("error", "channels publish", {
      error: "not found",
    });
    expect(record.success).toBe(false);
    expect(record.error).toBe("not found");
  });

  it("does not add success for event type", () => {
    const record = buildJsonRecord("event", "channels subscribe", {});
    expect(record).not.toHaveProperty("success");
  });

  it("does not add success for log type", () => {
    const record = buildJsonRecord("log", "channels subscribe", {
      component: "subscribe",
    });
    expect(record).not.toHaveProperty("success");
  });

  it("allows data to override success for partial-failure results", () => {
    const record = buildJsonRecord("result", "channels publish", {
      success: false,
      errors: 2,
      published: 3,
    });
    expect(record.success).toBe(false);
    expect(record.errors).toBe(2);
  });

  it("spreads all data fields into the record", () => {
    const record = buildJsonRecord("result", "test", {
      channels: ["a", "b"],
      nested: { x: 1 },
      total: 2,
    });
    expect(record.channels).toEqual(["a", "b"]);
    expect(record.nested).toEqual({ x: 1 });
    expect(record.total).toBe(2);
  });

  it("protects reserved envelope keys from data collision", () => {
    const record = buildJsonRecord("result", "channels:publish", {
      type: "custom",
      command: "override",
      foo: "bar",
    });
    expect(record.type).toBe("result");
    expect(record.command).toBe("channels:publish");
    expect(record.foo).toBe("bar");
  });

  it("does not allow data to override success on error type", () => {
    const record = buildJsonRecord("error", "channels publish", {
      success: true,
      error: "something failed",
    });
    expect(record.success).toBe(false);
    expect(record.error).toBe("something failed");
  });
});
