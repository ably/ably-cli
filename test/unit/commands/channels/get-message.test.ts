import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

const COMMAND = "channels:get-message";

describe("channels:get-message command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests(COMMAND, import.meta.url);
  standardArgValidationTests(COMMAND, import.meta.url, {
    requiredArgs: ["test-channel", "serial-001"],
  });
  standardFlagTests(COMMAND, import.meta.url, ["--json", "--cipher"]);

  describe("functionality", () => {
    it("calls channel.getMessage with the supplied serial", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [COMMAND, "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("test-channel", {});
      expect(channel.getMessage).toHaveBeenCalledExactlyOnceWith("serial-001");
    });

    it("passes cipher.key to channels.get when --cipher is provided", async () => {
      const mock = getMockAblyRest();

      await runCommand(
        [COMMAND, "test-channel", "serial-001", "--cipher", "my-secret-key"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("test-channel", {
        cipher: { key: "my-secret-key" },
      });
    });
  });

  describe("JSON output", () => {
    it("emits a `result` envelope with type=result, command, and success=true", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result");

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: "result",
        command: "channels:get-message",
        success: true,
      });
    });

    it("nests the SDK message under the `message` domain key with every populated field", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result") as
        | { message: Record<string, unknown> }
        | undefined;

      expect(result).toBeDefined();
      expect(result!.message).toMatchObject({
        id: "mock-message-id",
        name: "mock-event",
        data: { hello: "world" },
        encoding: "json",
        extras: { headers: { foo: "bar" } },
        serial: "mock-serial-001",
        clientId: "mock-client",
        connectionId: "mock-connection",
        action: "message.update",
      });
    });

    it("normalises `timestamp` to ISO 8601 in JSON", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result") as
        | { message: { timestamp: string } }
        | undefined;

      expect(result!.message.timestamp).toBe("2023-11-14T22:13:20.000Z");
    });

    it("preserves a legitimate epoch-zero timestamp (does not drop to undefined)", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.getMessage.mockResolvedValue({
        id: "epoch-id",
        serial: "epoch-serial",
        timestamp: 0,
        action: "message.create",
        data: "epoch-data",
      });

      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "epoch-serial", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result") as
        | { message: { timestamp: string } }
        | undefined;

      expect(result!.message.timestamp).toBe("1970-01-01T00:00:00.000Z");
    });

    it("stringifies `action` in JSON for predictable typing", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result") as
        | { message: { action: string } }
        | undefined;

      expect(typeof result!.message.action).toBe("string");
      expect(result!.message.action).toBe("message.update");
    });

    it("preserves nested `version` block verbatim", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result") as
        | { message: { version: Record<string, unknown> } }
        | undefined;

      expect(result!.message.version).toEqual({
        serial: "mock-serial-001@v2",
        timestamp: 1_700_000_001_000,
        clientId: "mock-editor",
        description: "Fixed typo",
      });
    });

    it("preserves nested `annotations.summary` verbatim", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result") as
        | { message: { annotations: { summary: Record<string, unknown> } } }
        | undefined;

      expect(result!.message.annotations.summary).toEqual({
        "reaction:distinct.v1": { unique: 3 },
      });
    });

    it("emits a trailing { type: 'status', status: 'completed' } line", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const last = records.at(-1);
      expect(last).toMatchObject({ type: "status", status: "completed" });
    });
  });

  describe("human-readable output", () => {
    it("renders header line `[timestamp]` only — no ordinal index for a single record", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001"],
        import.meta.url,
      );

      // The default mock timestamp 1_700_000_000_000 = 2023-11-14T22:13:20.000Z
      const firstLine = stdout.split("\n")[0];
      expect(firstLine).toContain("2023-11-14T22:13:20.000Z");
      // No ordinal index like `[1]` should precede the timestamp on the header.
      expect(firstLine).not.toMatch(/^\s*\[\d+]\s+\[/);
    });

    it("renders ID, Channel, Event, Action, Client ID, Serial, and Data labels", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(stdout).toContain("ID: mock-message-id");
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("mock-event");
      expect(stdout).toContain("message.update");
      expect(stdout).toContain("mock-client");
      expect(stdout).toContain("Serial: mock-serial-001");
      expect(stdout).toContain("Data");
      expect(stdout).toContain("hello");
    });

    it("renders nested Version block when version.serial differs from message.serial", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(stdout).toContain("Version");
      expect(stdout).toContain("mock-serial-001@v2");
      expect(stdout).toContain("mock-editor");
    });

    it("renders Annotations block when annotations.summary is populated", async () => {
      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(stdout).toContain("Annotations");
      expect(stdout).toContain("Summary");
      expect(stdout).toContain("reaction:distinct.v1");
      expect(stdout.indexOf("Annotations")).toBeLessThan(
        stdout.indexOf("Summary"),
      );
      expect(stdout.indexOf("Summary")).toBeLessThan(
        stdout.indexOf("reaction:distinct.v1"),
      );
    });

    it("renders message.delete action when retrieving a deleted message", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.getMessage.mockResolvedValue({
        id: "deleted-id",
        serial: "del-serial-001",
        timestamp: 1_700_000_000_000,
        action: "message.delete",
        data: null,
      });

      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "del-serial-001"],
        import.meta.url,
      );

      expect(stdout).toContain("message.delete");
    });
  });

  describe("error handling", () => {
    it("surfaces Ably errors via this.fail", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.getMessage.mockRejectedValue(new Error("Message not found"));

      const { error } = await runCommand(
        [COMMAND, "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Message not found");
    });

    it("enriches 40400 errors with the mutableMessages hint", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      const notFound = Object.assign(new Error("Message not found"), {
        code: 40400,
        statusCode: 404,
      });
      channel.getMessage.mockRejectedValue(notFound);

      const { error } = await runCommand(
        [COMMAND, "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Message not found");
      expect(error?.message).toContain("mutableMessages");
      expect(error?.message).toContain("ably apps rules list");
    });

    it("does NOT enrich non-40400 errors with the mutableMessages hint", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      const otherErr = Object.assign(new Error("Some other error"), {
        code: 50000,
        statusCode: 500,
      });
      channel.getMessage.mockRejectedValue(otherErr);

      const { error } = await runCommand(
        [COMMAND, "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Some other error");
      expect(error?.message).not.toContain("mutableMessages");
    });

    it("includes the mutableMessages hint in JSON error envelope for 40400", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      const notFound = Object.assign(new Error("Message not found"), {
        code: 40400,
        statusCode: 404,
      });
      channel.getMessage.mockRejectedValue(notFound);

      const { stdout } = await runCommand(
        [COMMAND, "test-channel", "serial-001", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const errorRecord = records.find((r) => r.type === "error") as
        | { error: { message: string; code: number } }
        | undefined;
      expect(errorRecord).toBeDefined();
      expect(errorRecord!.error.message).toContain("mutableMessages");
      expect(errorRecord!.error.code).toBe(40400);
    });
  });
});
