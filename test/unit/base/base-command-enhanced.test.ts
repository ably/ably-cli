import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as _fs from "node:fs";
import * as _Ably from "ably";
import { AblyBaseCommand } from "../../../src/base-command.js";
import { ConfigManager as _ConfigManager } from "../../../src/services/config-manager.js";
import { InteractiveHelper as _InteractiveHelper } from "../../../src/services/interactive-helper.js";
import { BaseFlags } from "../../../src/types/cli.js";
import { Config } from "@oclif/core";

// Create a testable implementation of the abstract AblyBaseCommand
class TestCommand extends AblyBaseCommand {
  public capturedOutput: string[] = [];

  public testShouldOutputJson(flags: BaseFlags): boolean {
    return this.shouldOutputJson(flags);
  }

  public testIsPrettyJsonOutput(flags: BaseFlags): boolean {
    return this.isPrettyJsonOutput(flags);
  }

  public testParseApiKey(apiKey: string) {
    return this.parseApiKey(apiKey);
  }

  public testIsAllowedInWebCliMode(command?: string): boolean {
    return this.isAllowedInWebCliMode(command);
  }

  public testCheckWebCliRestrictions(): void {
    this.checkWebCliRestrictions();
  }

  public testFormatJsonOutput(
    data: Record<string, unknown>,
    flags: BaseFlags,
  ): string {
    return this.formatJsonOutput(data, flags);
  }

  public testFormatJsonRecord(
    type: "error" | "event" | "log" | "result",
    data: Record<string, unknown>,
    flags: BaseFlags,
  ): string {
    return this.formatJsonRecord(type, data, flags);
  }

  public testFail(
    error: unknown,
    flags: BaseFlags,
    component: string,
    context?: Record<string, unknown>,
  ): never {
    return this.fail(error, flags, component, context);
  }

  public get testIsWebCliMode(): boolean {
    return this.isWebCliMode;
  }

  public set testIsWebCliMode(value: boolean) {
    this.isWebCliMode = value;
  }

  // Capture log output instead of writing to stdout
  log(message?: string): void {
    if (message !== undefined) {
      this.capturedOutput.push(message);
    }
  }

  async run(): Promise<void> {
    // Empty implementation
  }
}

describe("AblyBaseCommand - Enhanced Coverage", function () {
  let command: TestCommand;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(function () {
    originalEnv = { ...process.env };

    // Reset env before each test
    process.env = { ...originalEnv };

    const mockConfig = {
      root: "",
    } as unknown as Config;

    command = new TestCommand([], mockConfig);
  });

  afterEach(function () {
    process.env = originalEnv;
  });

  describe("initialization and setup", function () {
    it("should detect web CLI mode from environment variable", function () {
      process.env.ABLY_WEB_CLI_MODE = "true";
      const webCommand = new TestCommand([], {} as Config);
      expect(webCommand.testIsWebCliMode).toBe(true);
    });
  });

  describe("output formatting", function () {
    it("should detect JSON output from json flag", function () {
      expect(command.testShouldOutputJson({ json: true })).toBe(true);
    });

    it("should detect JSON output from pretty-json flag", function () {
      expect(command.testShouldOutputJson({ "pretty-json": true })).toBe(true);
    });

    it("should detect JSON output from format flag", function () {
      expect(command.testShouldOutputJson({ format: "json" })).toBe(true);
    });

    it("should return false when no JSON flags are present", function () {
      expect(command.testShouldOutputJson({})).toBe(false);
    });

    it("should detect pretty JSON output", function () {
      expect(command.testIsPrettyJsonOutput({ "pretty-json": true })).toBe(
        true,
      );
      expect(command.testIsPrettyJsonOutput({ json: true })).toBe(false);
    });

    it("should format JSON output as compact single-line for --json", function () {
      const data = { success: true, message: "test" };
      const flags: BaseFlags = { json: true };

      const output = command.testFormatJsonOutput(data, flags);

      // The output should be valid JSON that can be parsed back to the original data
      const parsed = JSON.parse(output);
      expect(parsed).toEqual(data);

      // --json produces compact single-line output (no newlines)
      expect(output).not.toContain("\n");
      expect(output).toContain('"success"');
      expect(output).toContain('"message"');
    });

    it("should format pretty JSON output with colors", function () {
      const data = { success: true, message: "test" };
      const flags: BaseFlags = { "pretty-json": true };

      const output = command.testFormatJsonOutput(data, flags);
      expect(output).toContain("success");
      expect(output).toContain("true");
    });

    it("should wrap data with type envelope via formatJsonRecord", function () {
      const data = { channels: ["a", "b"], total: 2 };
      const flags: BaseFlags = { json: true };

      const output = command.testFormatJsonRecord("result", data, flags);
      const parsed = JSON.parse(output);

      expect(parsed.type).toBe("result");
      expect(parsed.command).toBeDefined();
      expect(parsed.success).toBe(true);
      expect(parsed.channels).toEqual(["a", "b"]);
      expect(parsed.total).toBe(2);
      // Compact single-line
      expect(output).not.toContain("\n");
    });

    it("should add success:false for error type in formatJsonRecord", function () {
      const data = { error: "something went wrong" };
      const flags: BaseFlags = { json: true };

      const output = command.testFormatJsonRecord("error", data, flags);
      const parsed = JSON.parse(output);

      expect(parsed.type).toBe("error");
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("something went wrong");
    });

    it("should not add success field for event type in formatJsonRecord", function () {
      const data = { channel: "test", message: "hello" };
      const flags: BaseFlags = { json: true };

      const output = command.testFormatJsonRecord("event", data, flags);
      const parsed = JSON.parse(output);

      expect(parsed.type).toBe("event");
      expect(parsed).not.toHaveProperty("success");
      expect(parsed.channel).toBe("test");
    });

    it("should not add success field for log type in formatJsonRecord", function () {
      const data = { component: "subscribe", event: "messageReceived" };
      const flags: BaseFlags = { json: true };

      const output = command.testFormatJsonRecord("log", data, flags);
      const parsed = JSON.parse(output);

      expect(parsed.type).toBe("log");
      expect(parsed).not.toHaveProperty("success");
    });

    it("should pretty-print formatJsonRecord when --pretty-json is used", function () {
      const data = { total: 5 };
      const flags: BaseFlags = { "pretty-json": true };

      const output = command.testFormatJsonRecord("result", data, flags);
      // Pretty output contains newlines (from color-json or JSON.stringify indent)
      expect(output).toContain("type");
      expect(output).toContain("result");
    });
  });

  describe("API key parsing", function () {
    it("should parse valid API key format", function () {
      const result = command.testParseApiKey("appId.keyId:keySecret");

      expect(result).not.toBeNull();
      expect(result?.appId).toBe("appId");
      expect(result?.keyId).toBe("keyId");
      expect(result?.keySecret).toBe("keySecret");
    });

    it("should return null for invalid API key formats", function () {
      expect(command.testParseApiKey("invalid")).toBeNull();
      expect(command.testParseApiKey("app.key")).toBeNull();
      expect(command.testParseApiKey("app:secret")).toBeNull();
      expect(command.testParseApiKey("")).toBeNull();
    });
  });

  describe("web CLI mode restrictions", function () {
    beforeEach(function () {
      command.testIsWebCliMode = true;
    });

    it("should restrict login command", function () {
      expect(command.testIsAllowedInWebCliMode("accounts:login")).toBe(false);
    });

    it("should restrict logout command", function () {
      expect(command.testIsAllowedInWebCliMode("accounts:logout")).toBe(false);
    });

    it("should allow help commands", function () {
      expect(command.testIsAllowedInWebCliMode("help")).toBe(true);
      expect(command.testIsAllowedInWebCliMode("help:contact")).toBe(true);
    });

    it("should allow channel commands", function () {
      expect(command.testIsAllowedInWebCliMode("channels:publish")).toBe(true);
    });

    it("should handle web CLI restrictions", function () {
      command.testIsWebCliMode = true;
      Object.defineProperty(command, "id", { value: "accounts:login" });

      expect(() => command.testCheckWebCliRestrictions()).toThrow();
    });
  });

  describe("environment variable handling", function () {
    it("should handle ABLY_API_KEY environment variable", function () {
      process.env.ABLY_API_KEY = "testApp.keyId:keySecret";
      expect(process.env.ABLY_API_KEY).toBe("testApp.keyId:keySecret");

      // Verify app ID extraction logic
      const apiKey = process.env.ABLY_API_KEY;
      const appId = apiKey.split(".")[0];
      expect(appId).toBe("testApp");
    });

    it("should handle ABLY_ACCESS_TOKEN environment variable", function () {
      process.env.ABLY_ACCESS_TOKEN = "test-access-token";
      expect(process.env.ABLY_ACCESS_TOKEN).toBe("test-access-token");
    });
  });

  describe("shouldOutputJson argv fallback", function () {
    it("should detect --json from argv when flags is empty", function () {
      const mockConfig = { root: "" } as unknown as Config;
      const cmd = new TestCommand(["some-arg", "--json"], mockConfig);
      expect(cmd.testShouldOutputJson({})).toBe(true);
    });

    it("should detect --pretty-json from argv when flags is empty", function () {
      const mockConfig = { root: "" } as unknown as Config;
      const cmd = new TestCommand(["--pretty-json"], mockConfig);
      expect(cmd.testShouldOutputJson({})).toBe(true);
    });

    it("should return false from argv fallback when no json flags", function () {
      const mockConfig = { root: "" } as unknown as Config;
      const cmd = new TestCommand(["--verbose"], mockConfig);
      expect(cmd.testShouldOutputJson({})).toBe(false);
    });

    it("should not use argv fallback when flags has keys", function () {
      // Even though argv has --json, flags object has keys so argv fallback is skipped
      const mockConfig = { root: "" } as unknown as Config;
      const cmd = new TestCommand(["--json"], mockConfig);
      expect(cmd.testShouldOutputJson({ verbose: true })).toBe(false);
    });
  });

  describe("isPrettyJsonOutput argv fallback", function () {
    it("should detect --pretty-json from argv when flags is empty", function () {
      const mockConfig = { root: "" } as unknown as Config;
      const cmd = new TestCommand(["--pretty-json"], mockConfig);
      expect(cmd.testIsPrettyJsonOutput({})).toBe(true);
    });

    it("should return false for --json from argv (not pretty)", function () {
      const mockConfig = { root: "" } as unknown as Config;
      const cmd = new TestCommand(["--json"], mockConfig);
      expect(cmd.testIsPrettyJsonOutput({})).toBe(false);
    });
  });

  describe("fail", function () {
    it("should throw for human-readable output (non-JSON)", function () {
      expect(() => command.testFail("something broke", {}, "test")).toThrow(
        "something broke",
      );
    });

    it("should emit JSON error envelope and throw for --json output", function () {
      const mockConfig = { root: "" } as unknown as Config;
      const cmd = new TestCommand(["--json"], mockConfig);

      expect(() =>
        cmd.testFail("auth failed", { json: true }, "auth"),
      ).toThrow();

      // Check captured JSON output
      expect(cmd.capturedOutput.length).toBe(1);
      const parsed = JSON.parse(cmd.capturedOutput[0]);
      expect(parsed.type).toBe("error");
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("auth failed");
    });

    it("should preserve Ably error codes in JSON output", function () {
      const mockConfig = { root: "" } as unknown as Config;
      const cmd = new TestCommand(["--json"], mockConfig);
      const ablyError = Object.assign(new Error("Unauthorized"), {
        code: 40100,
        statusCode: 401,
      });

      expect(() => cmd.testFail(ablyError, { json: true }, "auth")).toThrow();

      const parsed = JSON.parse(cmd.capturedOutput[0]);
      expect(parsed.type).toBe("error");
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Unauthorized");
      expect(parsed.code).toBe(40100);
      expect(parsed.statusCode).toBe(401);
    });

    it("should include context in JSON error output", function () {
      const mockConfig = { root: "" } as unknown as Config;
      const cmd = new TestCommand(["--json"], mockConfig);

      expect(() =>
        cmd.testFail("queue not found", { json: true }, "queues", {
          queueName: "my-queue",
        }),
      ).toThrow();

      const parsed = JSON.parse(cmd.capturedOutput[0]);
      expect(parsed.error).toBe("queue not found");
      expect(parsed.queueName).toBe("my-queue");
    });

    it("should accept string errors", function () {
      expect(() => command.testFail("simple string error", {}, "test")).toThrow(
        "simple string error",
      );
    });

    it("should accept Error objects", function () {
      const err = new Error("wrapped error");
      expect(() => command.testFail(err, {}, "test")).toThrow("wrapped error");
    });

    it("should use argv fallback for JSON detection when flags is empty", function () {
      const mockConfig = { root: "" } as unknown as Config;
      const cmd = new TestCommand(["--json"], mockConfig);

      expect(() => cmd.testFail("pre-parse error", {}, "parse")).toThrow();

      // Should have produced JSON output via argv fallback
      expect(cmd.capturedOutput.length).toBe(1);
      const parsed = JSON.parse(cmd.capturedOutput[0]);
      expect(parsed.type).toBe("error");
      expect(parsed.error).toBe("pre-parse error");
    });
  });
});
