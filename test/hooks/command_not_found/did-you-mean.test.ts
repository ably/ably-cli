import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { Args, Command, Config, Errors, Flags } from "@oclif/core";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Import the compiled hook function
import hook from "../../../src/hooks/command_not_found/did-you-mean.js";

// Helper regex to strip ANSI codes for matching
// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replaceAll(/\u001B\[(?:\d*;)*\d*m/g, "");

// Mock command load
class MockCmdClass {
  static args = {
    channel: Args.string({
      description: "Channel to subscribe to",
      required: true,
    }),
  };

  static description = "Subscribe to a channel";
  static flags = {
    "hidden-flag": Flags.boolean({ hidden: true }),
    "some-flag": Flags.string({ char: "f", description: "A flag" }),
  };

  static id = "channels:subscribe";
  static usage = "channels subscribe CHANNEL_NAME";
  async run() {}
}

// Helper to create a minimal config for testing
async function createTestConfig(): Promise<Config> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const root = path.resolve(__dirname, "../../../");
  const config = new Config({ root });
  await config.load();
  const loadableCmd: Command.Loadable = {
    aliases: [],
    args: MockCmdClass.args,
    flags: MockCmdClass.flags,
    hidden: false,
    hiddenAliases: [],
    id: "channels:subscribe",
    load: async () => MockCmdClass as unknown as Command.Class,
    pluginAlias: "@ably/cli",
    pluginType: "core",
  };
  config.commands.push(
    loadableCmd,
    {
      id: "channels:publish",
      // Define args for channels:publish to match the error message
      args: {
        channel: Args.string({ required: true }),
        message: Args.string({ required: true }),
      },
      // Add minimum required properties for Command.Loadable type
      aliases: [],
      flags: {},
      hidden: false,
      hiddenAliases: [],
      load: async () => ({ async run() {} }) as any,
    } as Command.Loadable,
    {
      id: "channels:list",
      // Add minimum required properties for Command.Loadable type
      aliases: [],
      flags: {},
      hidden: false,
      hiddenAliases: [],
      args: {},
      load: async () => ({ async run() {} }) as any,
    } as Command.Loadable,
    {
      id: "help",
      // Add minimum required properties for Command.Loadable type
      aliases: [],
      flags: {},
      hidden: false,
      hiddenAliases: [],
      args: {},
      load: async () => ({ async run() {} }) as any,
    } as Command.Loadable,
  );
  config.commandIDs.push(
    "channels:subscribe",
    "channels:publish",
    "channels:list",
    "help",
  );
  config.topics.push({
    description: "Channel commands",
    name: "channels",
  } as any);
  return config;
}

// Define custom context interface
interface TestContext {
  config: Config;
  mockContext: any;
  stubs: {
    log: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    exit: ReturnType<typeof vi.fn>;
    runCommand: ReturnType<typeof vi.fn>;
  };
}

// Helper function to setup test context
async function setupTestContext(): Promise<TestContext> {
  const config = await createTestConfig();

  const stubs = {
    log: vi.spyOn(console, "log"),
    warn: vi.spyOn(console, "warn"),
    error: vi.spyOn(console, "error"),
    exit: vi.spyOn(process, "exit").mockReturnValue(undefined as never),
    runCommand: vi
      .spyOn(Config.prototype, "runCommand")
      .mockImplementation(async () => {}),
  };

  const mockContext = {
    config: config,
    debug: vi.fn(),
    error(
      input: Error | string,
      options: { code?: string; exit: false | number } = { exit: 1 },
    ) {
      stubs.error(input instanceof Error ? input.message : input);

      const errorToThrow =
        input instanceof Error ? input : new TypeError(String(input));
      const exitCode =
        options?.exit ??
        (input instanceof Errors.CLIError
          ? (input as any).oclif?.exit
          : undefined) ??
        1;
      if (exitCode !== false) {
        (errorToThrow as any).oclif = { exit: exitCode };
      }
      throw errorToThrow;
    },
    exit: (code?: number) => stubs.exit(code ?? 0),
    log: (...args: any[]) => stubs.log(...args),
    warn: (...args: any[]) => stubs.warn(...args),
  };

  return { config, mockContext, stubs };
}

// Helper function to setup test context with rejecting runCommand stub
async function setupRejectingTestContext(): Promise<TestContext> {
  const config = await createTestConfig();

  const stubs = {
    log: vi.spyOn(console, "log"),
    warn: vi.spyOn(console, "warn"),
    error: vi.spyOn(console, "error"),
    exit: vi.spyOn(process, "exit").mockReturnValue(undefined as never),
    runCommand: vi.spyOn(Config.prototype, "runCommand"),
  };

  const mockContext = {
    config: config,
    debug: vi.fn(),
    error(
      input: Error | string,
      options: { code?: string; exit: false | number } = { exit: 1 },
    ) {
      stubs.error(input instanceof Error ? input.message : input);

      const errorToThrow =
        input instanceof Error ? input : new TypeError(String(input));
      const exitCode =
        options?.exit ??
        (input instanceof Errors.CLIError
          ? (input as any).oclif?.exit
          : undefined) ??
        1;
      if (exitCode !== false) {
        (errorToThrow as any).oclif = { exit: exitCode };
      }
      throw errorToThrow;
    },
    exit: (code?: number) => stubs.exit(code ?? 0),
    log: (...args: any[]) => stubs.log(...args),
    warn: (...args: any[]) => stubs.warn(...args),
  };

  return { config, mockContext, stubs };
}

describe("Command Not Found Hook", () => {
  beforeEach(() => {
    process.env.SKIP_CONFIRMATION = "true";
  });

  afterEach(() => {
    delete process.env.SKIP_CONFIRMATION;
  });

  it("should warn with space separator and run the suggested command (colon input)", async () => {
    const ctx = await setupTestContext();
    const hookOpts = {
      argv: [],
      config: ctx.config,
      context: ctx.mockContext,
      id: "channels:pubish", // User typo with colon
    };
    ctx.config.topicSeparator = " ";

    await hook.apply(ctx.mockContext, [hookOpts]);

    expect(ctx.stubs.warn).toHaveBeenCalledOnce();
    const warnArg = ctx.stubs.warn.mock.calls[0][0];
    expect(stripAnsi(warnArg)).toContain(
      "channels pubish is not an ably command",
    );
    expect(ctx.stubs.runCommand).toHaveBeenCalledOnce();
    expect(ctx.stubs.runCommand).toHaveBeenCalledWith("channels:publish", []);
  });

  it("should warn with space separator and run the suggested command (space input)", async () => {
    const ctx = await setupTestContext();
    const hookOpts = {
      argv: [],
      config: ctx.config,
      context: ctx.mockContext,
      id: "channels pubish", // User typo with space
    };
    ctx.config.topicSeparator = " ";

    await hook.apply(ctx.mockContext, [hookOpts]);

    expect(ctx.stubs.warn).toHaveBeenCalledOnce();
    const warnArg = ctx.stubs.warn.mock.calls[0][0];
    expect(stripAnsi(warnArg)).toContain(
      "channels pubish is not an ably command",
    );
    expect(ctx.stubs.runCommand).toHaveBeenCalledOnce();
    expect(ctx.stubs.runCommand).toHaveBeenCalledWith("channels:publish", []);
  });

  it("should pass arguments when running suggested command (space input)", async () => {
    const ctx = await setupTestContext();
    const originalArgv = process.argv;
    process.argv = [
      "node",
      "bin/run",
      "channels",
      "publsh", // Typo
      "my-arg1", // Arg intended for corrected command
      "--flag", // Flag intended for corrected command
    ];
    const hookOpts = {
      argv: ["my-arg1", "--flag"],
      config: ctx.config,
      context: ctx.mockContext,
      id: "channels publsh", // Typo with space
    };
    ctx.config.topicSeparator = " ";

    await hook.apply(ctx.mockContext, [hookOpts]);

    expect(ctx.stubs.warn).toHaveBeenCalledOnce();
    const warnArg = ctx.stubs.warn.mock.calls[0][0];
    expect(stripAnsi(warnArg)).toContain(
      "channels publsh is not an ably command",
    );
    expect(ctx.stubs.runCommand).toHaveBeenCalledOnce();
    expect(ctx.stubs.runCommand).toHaveBeenCalledWith("channels:publish", [
      "my-arg1",
      "--flag",
    ]);

    process.argv = originalArgv;
  });

  it("should error correctly for completely unknown command (space input)", async () => {
    const ctx = await setupTestContext();
    const hookOpts = {
      argv: [],
      config: ctx.config,
      context: ctx.mockContext,
      id: "xyzxyzxyz completely nonexistent command",
    };
    ctx.config.topicSeparator = " ";

    let errorCaught = false;
    try {
      await hook.apply(ctx.mockContext, [hookOpts]);
    } catch (error: unknown) {
      errorCaught = true;
      expect((error as Error).message).toContain(
        "Command xyzxyzxyz completely nonexistent command not found",
      );
    }

    expect(errorCaught).toBe(true);
    expect(ctx.stubs.warn).not.toHaveBeenCalled();
    expect(ctx.stubs.runCommand).not.toHaveBeenCalled();
    expect(ctx.stubs.error).toHaveBeenCalledOnce();

    const errorArg = ctx.stubs.error.mock.calls[0][0];
    expect(stripAnsi(String(errorArg))).toContain(
      "xyzxyzxyz completely nonexistent command not found",
    );
    expect(stripAnsi(String(errorArg))).toContain(
      "Run ably --help for a list of available commands",
    );
  });

  it("should show generic help if no close command is found", async () => {
    const ctx = await setupTestContext();
    const hookOpts = {
      argv: [],
      config: ctx.config,
      context: ctx.mockContext,
      id: "xyzxyzxyzabc",
    };

    let errorThrown = false;
    try {
      await hook.apply(ctx.mockContext, [hookOpts]);
    } catch {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);
    expect(ctx.stubs.warn).not.toHaveBeenCalled();
    expect(ctx.stubs.runCommand).not.toHaveBeenCalled();

    expect(ctx.stubs.error).toHaveBeenCalledOnce();
    const errorArg = ctx.stubs.error.mock.calls[0][0];
    expect(stripAnsi(String(errorArg))).toContain("xyzxyzxyzabc not found");
    expect(stripAnsi(String(errorArg))).toContain(
      "Run ably --help for a list of available commands",
    );
  });

  it("should show command help with full help command for missing required arguments", async () => {
    const ctx = await setupRejectingTestContext();
    const missingArgsError = new Errors.CLIError(
      "Missing 1 required arg: channel\nSee more help with --help",
    );
    missingArgsError.oclif = { exit: 1 };

    ctx.stubs.runCommand
      .withArgs("channels:subscribe", [])
      .mockRejectedValue(missingArgsError);

    const hookOpts = {
      argv: [],
      config: ctx.config,
      context: ctx.mockContext,
      id: "channels subscrib", // Typo with space
    };
    ctx.config.topicSeparator = " ";

    let errorCaught = false;
    try {
      await hook.apply(ctx.mockContext, [hookOpts]);
    } catch (error: unknown) {
      errorCaught = true;
      const errorMsg = (error as Error).message;
      expect(errorMsg).toContain("Missing 1 required arg: channel");
      expect(errorMsg).toContain("See more help with:");
      expect(errorMsg).toContain("ably channels subscribe --help");
      expect(errorMsg).not.toContain("See more help with --help");
    }

    expect(errorCaught).toBe(true);
    expect(ctx.stubs.warn).toHaveBeenCalledOnce();
    expect(ctx.stubs.runCommand).toHaveBeenCalledOnce();
    expect(ctx.stubs.runCommand).toHaveBeenCalledWith("channels:subscribe", []);

    expect(ctx.stubs.log).toHaveBeenCalled();

    let usageCall = false;
    let helpCall = false;

    for (let i = 0; i < ctx.stubs.log.mock.calls.length; i++) {
      const callArg = ctx.stubs.log.mock.calls[i][0];
      if (typeof callArg === "string") {
        if (callArg === "\nUSAGE") {
          usageCall = true;
        }
        if (callArg.includes("See more help with:")) {
          helpCall = true;
        }
      }
    }

    expect(usageCall).toBe(true);
    expect(helpCall).toBe(true);
  });

  it("should correctly suggest and run help for a command", async () => {
    const ctx = await setupTestContext();
    const hookOpts = {
      argv: [],
      config: ctx.config,
      context: ctx.mockContext,
      id: "hep", // Typo for "help"
    };
    await hook.apply(ctx.mockContext, [hookOpts]);

    expect(ctx.stubs.warn).toHaveBeenCalledOnce();
    const warnArg = ctx.stubs.warn.mock.calls[0][0];
    expect(stripAnsi(warnArg)).toContain("hep is not an ably command");
    expect(ctx.stubs.runCommand).toHaveBeenCalledWith("help", []);
  });

  it("should attempt suggested command and propagate its error (space input)", async () => {
    const ctx = await setupTestContext();
    const missingArgsError = new Errors.CLIError(
      "Missing 1 required arg: channel",
    );
    missingArgsError.oclif = { exit: 1 };

    ctx.stubs.runCommand
      .withArgs("channels:subscribe", [])
      .mockRejectedValue(missingArgsError);

    const hookOpts = {
      argv: [],
      config: ctx.config,
      context: ctx.mockContext,
      id: "channels subscrib", // Typo with space
    };
    ctx.config.topicSeparator = " ";

    let errorCaught = false;
    try {
      await hook.apply(ctx.mockContext, [hookOpts]);
    } catch (error: unknown) {
      errorCaught = true;
      expect((error as Error).message).toBe("Missing 1 required arg: channel");
    }

    expect(errorCaught).toBe(true);
    expect(ctx.stubs.warn).toHaveBeenCalledOnce();
    expect(ctx.stubs.runCommand).toHaveBeenCalledOnce();
    expect(ctx.stubs.runCommand).toHaveBeenCalledWith("channels:subscribe", []);
  });

  it("should handle arguments when suggesting commands with a typo", async () => {
    const ctx = await setupTestContext();
    const hookOpts = {
      argv: [],
      config: ctx.config,
      context: ctx.mockContext,
      id: "channels:publis:foo:bar", // Real CLI format with colons
    };
    ctx.config.topicSeparator = " ";

    await hook.apply(ctx.mockContext, [hookOpts]);

    expect(ctx.stubs.warn).toHaveBeenCalledOnce();
    const warnArg = ctx.stubs.warn.mock.calls[0][0];
    expect(stripAnsi(warnArg)).toContain(
      "channels publis is not an ably command",
    );

    expect(ctx.stubs.runCommand).toHaveBeenCalledOnce();
    expect(ctx.stubs.runCommand).toHaveBeenCalledWith("channels:publish", [
      "foo",
      "bar",
    ]);
  });
});
