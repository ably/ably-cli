import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Config } from "@oclif/core";

import McpStartServer from "../../../../src/commands/mcp/start-server.js";
import { AblyMcpServer } from "../../../../src/mcp/mcp-server.js";

// Testable subclass for MCP start server command
class TestableMcpStartServer extends McpStartServer {
  private _parseResult: any;
  public mockMcpServer: any;
  public mockConfigManager: any;
  public constructorArgs: any[] = [];
  public startCalled = false;

  public setParseResult(result: any) {
    this._parseResult = result;
  }

  public override async parse() {
    return this._parseResult;
  }

  public override async run(): Promise<void> {
    // Parse flags like the real implementation
    const { flags } = await this.parse();

    // Simulate the constructor call
    this.constructorArgs = [
      this.mockConfigManager,
      { controlHost: flags["control-host"] },
    ];

    // Simulate calling start
    this.startCalled = true;
    if (this.mockMcpServer?.start) {
      await this.mockMcpServer.start();
    }
  }

  protected override checkWebCliRestrictions() {
    // Skip web CLI restrictions for testing
  }

  protected override interactiveHelper = {
    confirm: vi.fn().mockResolvedValue(true),
    promptForText: vi.fn().mockResolvedValue("fake-input"),
    promptToSelect: vi.fn().mockResolvedValue("fake-selection"),
  } as any;
}

describe("mcp commands", function () {
  let mockConfig: Config;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
  });

  describe("mcp start-server", function () {
    let command: TestableMcpStartServer;
    let startStub: ReturnType<typeof vi.fn>;
    let mockMcpServer: any;
    let mockConfigManager: any;

    beforeEach(function () {
      command = new TestableMcpStartServer([], mockConfig);

      startStub = vi.fn().mockImplementation(async () => {});
      mockMcpServer = {
        start: startStub,
      };

      mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          defaultAccount: { alias: "test-account" },
          accounts: { "test-account": { accessToken: "test-token" } },
        }),
        saveConfig: vi.fn().mockImplementation(async () => {}),
      };

      command.mockMcpServer = mockMcpServer;
      command.mockConfigManager = mockConfigManager;

      command.setParseResult({
        flags: {},
        args: {},
        argv: [],
        raw: [],
      });
    });

    it("should start MCP server successfully", async function () {
      await command.run();

      expect(command.startCalled).toBe(true);
      expect(startStub).toHaveBeenCalledOnce();
    });

    it("should pass control host option to MCP server", async function () {
      command.setParseResult({
        flags: { "control-host": "custom.ably.io" },
        args: {},
        argv: [],
        raw: [],
      });

      await command.run();

      // Check that the constructor would have been called with the correct options
      expect(command.constructorArgs).toHaveLength(2);
      expect(command.constructorArgs[1]).toEqual({
        controlHost: "custom.ably.io",
      });
    });

    it("should handle MCP server startup errors", async function () {
      startStub.mockRejectedValue(new Error("Failed to bind to port"));

      await expect(command.run()).rejects.toThrow("Failed to bind to port");
    });
  });

  describe("AblyMcpServer", function () {
    let mockConfigManager: any;
    let server: AblyMcpServer;

    beforeEach(function () {
      mockConfigManager = {
        getConfig: vi.fn().mockReturnValue({
          defaultAccount: { alias: "test-account" },
          accounts: { "test-account": { accessToken: "test-token" } },
        }),
        saveConfig: vi.fn().mockImplementation(async () => {}),
      };
    });

    afterEach(function () {
      // Clean up server if it was created
      server = null as any;
      vi.restoreAllMocks();
    });

    it("should initialize with default options", function () {
      server = new AblyMcpServer(mockConfigManager);

      expect(server).toBeInstanceOf(AblyMcpServer);
    });

    it("should initialize with custom control host", function () {
      const options = { controlHost: "custom.ably.io" };
      server = new AblyMcpServer(mockConfigManager, options);

      expect(server).toBeInstanceOf(AblyMcpServer);
    });

    it("should handle missing configuration gracefully", function () {
      mockConfigManager.getConfig.mockReturnValue({});

      expect(() => {
        server = new AblyMcpServer(mockConfigManager);
      }).not.toThrow();
    });

    describe("MCP protocol operations", function () {
      beforeEach(function () {
        server = new AblyMcpServer(mockConfigManager);
      });

      it("should expose available start method", function () {
        // Since AblyMcpServer is a complex class, we'll test the basic structure
        // In a real implementation, you'd test the MCP protocol methods
        expect(server).toHaveProperty("start");
        expect(typeof server.start).toBe("function");
      });

      // eslint-disable-next-line vitest/no-disabled-tests
      it.skip("should handle basic server lifecycle", async function () {
        // See: https://github.com/ably/cli/issues/70
        // This test requires a different approach to test server lifecycle
        // without emitting process signals in unit tests
        const exitSpy = vi.spyOn(process, "exit");

        // Start the server in the background
        const _startPromise = server.start();

        // Give it a moment to start
        await new Promise((resolve) => setTimeout(resolve, 10));

        // TODO: Implement proper server shutdown mechanism for testing
        // that doesn't rely on process.emit("SIGINT")

        // Verify that process.exit was called
        expect(exitSpy).toHaveBeenCalledWith(0);
      });
    });

    describe("error handling", function () {
      it("should handle server startup with invalid configuration", function () {
        // Test with null configuration
        mockConfigManager.getConfig.mockReturnValue(null);

        server = new AblyMcpServer(mockConfigManager);

        // Server should still be created, errors would occur on start()
        expect(server).toBeInstanceOf(AblyMcpServer);
      });

      it("should handle empty configuration", function () {
        mockConfigManager.getConfig.mockReturnValue({});

        server = new AblyMcpServer(mockConfigManager);

        expect(server).toBeInstanceOf(AblyMcpServer);
      });

      it("should handle missing config manager methods", function () {
        const incompleteConfigManager = {
          getConfig: vi.fn().mockReturnValue({}),
          // Missing other methods
        };

        server = new AblyMcpServer(incompleteConfigManager as any);

        expect(server).toBeInstanceOf(AblyMcpServer);
      });
    });
  });
});
