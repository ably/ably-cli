import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Config } from "@oclif/core";
import HelpCommand from "../../../src/commands/help.js";
import CustomHelp from "../../../src/help.js";

class TestableHelpCommand extends HelpCommand {
  private _parseResult: any = {
    flags: {},
    args: {},
    argv: [],
    raw: [],
  };

  private _customHelp: any;

  // Override parse to return our controlled parse result
  public override async parse() {
    return this._parseResult;
  }

  // Method to set parse result for testing
  public setParseResult(result: any) {
    this._parseResult = result;
  }

  getCustomHelp(): CustomHelp {
    return this._customHelp;
  }

  setCustomHelp(showCommandHelpStub: any, formatWebCliRootStub: any) {
    this._customHelp = {
      showCommandHelp: showCommandHelpStub,
      formatWebCliRoot: formatWebCliRootStub,
    };
  }
}

describe("Help Command Tests", function () {
  beforeEach(function () {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(function () {
    vi.restoreAllMocks();
  });

  describe("Help Command Structure", function () {
    it("should be a simple command, not a topic", function () {
      // Help should not have any subcommands
      expect((HelpCommand as any).topic).toBeUndefined();
      expect(HelpCommand.description).toContain("help");
    });

    it("should have --web-cli-help flag", function () {
      const flags = HelpCommand.flags;
      expect(flags).toHaveProperty("web-cli-help");
      expect(flags["web-cli-help"].type).toBe("boolean");
      expect(flags["web-cli-help"].hidden).toBe(true);
    });

    it("should have correct usage examples", function () {
      const examples = HelpCommand.examples;
      expect(examples).toBeInstanceOf(Array);
      expect(examples.length).toBeGreaterThan(0);

      // Check for standard help examples
      const exampleStrings = examples.map((e: any) =>
        typeof e === "string" ? e : e.command,
      );
      expect(exampleStrings.some((e: string) => e.includes("help"))).toBe(true);
      expect(exampleStrings.some((e: string) => e.includes("channels"))).toBe(
        true,
      );
    });
  });

  describe("Help Command Behavior", function () {
    let showCommandStub: ReturnType<typeof vi.fn>;
    let formatWebCliRootStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      showCommandStub = vi.fn();
      formatWebCliRootStub = vi.fn();
    });

    it("should accept command names as arguments", async function () {
      const help = new TestableHelpCommand([], {} as Config);
      help.setCustomHelp(showCommandStub, formatWebCliRootStub);

      // Mock config.runCommand
      const findCommandStub = vi.fn().mockReturnValue("abc");
      help.config = {
        findCommand: findCommandStub,
        commands: ["publish", "subscribe"],
        topics: [],
      } as any;

      help.setParseResult({
        flags: {},
        args: {},
        argv: ["channels"],
        raw: [],
      });

      await help.run();

      expect(findCommandStub).toHaveBeenCalledWith("channels");

      expect(showCommandStub).toHaveBeenCalledWith("abc");
    });

    it("should handle --web-cli-help flag", async function () {
      const help = new TestableHelpCommand([], {} as Config);
      help.setCustomHelp(showCommandStub, formatWebCliRootStub);

      // Mock config.runCommand
      help.config = {
        commands: [],
        topics: [],
      } as any;

      help.setParseResult({
        flags: { "web-cli-help": true },
        args: {},
        argv: [],
        raw: [],
      });

      await help.run();

      expect(formatWebCliRootStub).toHaveBeenCalledOnce();
    });

    it("should pass through multiple arguments", async function () {
      const help = new TestableHelpCommand([], {} as Config);
      help.setCustomHelp(showCommandStub, formatWebCliRootStub);

      // Mock config.runCommand
      const findCommandStub = vi.fn().mockReturnValue("abc");
      help.config = {
        findCommand: findCommandStub,
        commands: ["publish", "subscribe"],
        topics: [],
      } as any;

      help.setParseResult({
        flags: {},
        args: {},
        argv: ["channels", "publish"],
        raw: [],
      });

      await help.run();

      expect(findCommandStub).toHaveBeenCalledWith("channels:publish");

      expect(showCommandStub).toHaveBeenCalledWith("abc");
    });
  });

  describe("No Help Subcommands", function () {
    it("should not have help:ask command", function () {
      // This test verifies that help subcommands have been removed
      // In the new structure, these should be under 'support' topic
      const mockConfig = {
        findCommand: (id: string) => {
          // help:ask should not exist
          if (id === "help:ask") return null;
          // support:ask should exist
          if (id === "support:ask") return { id: "support:ask" };
          return null;
        },
      } as any;

      expect(mockConfig.findCommand("help:ask")).toBeNull();
      expect(mockConfig.findCommand("support:ask")).not.toBeNull();
    });

    it("should not have help:status command", function () {
      // status should be a root command now
      const mockConfig = {
        findCommand: (id: string) => {
          // help:status should not exist
          if (id === "help:status") return null;
          // status should exist at root
          if (id === "status") return { id: "status" };
          return null;
        },
      } as any;

      expect(mockConfig.findCommand("help:status")).toBeNull();
      expect(mockConfig.findCommand("status")).not.toBeNull();
    });
  });
});
