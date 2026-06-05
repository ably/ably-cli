import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";
import { parseJsonOutput } from "../../../helpers/ndjson.js";

describe("push:publish command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:publish", import.meta.url);
  standardArgValidationTests("push:publish", import.meta.url);

  describe("argument validation", () => {
    it("should require a recipient or channel name", async () => {
      const { error } = await runCommand(
        ["push:publish", "--title", "Hello"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });

  standardFlagTests("push:publish", import.meta.url, [
    "--json",
    "--device-id",
    "--client-id",
    "--channel",
    "--title",
    "--body",
    "--payload",
    "--message",
  ]);

  describe("functionality", () => {
    it("should publish to a device", async () => {
      const mock = getMockAblyRest();

      const { stderr } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "dev-1",
          "--title",
          "Hello",
          "--body",
          "World",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("published");
      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "dev-1" },
        expect.objectContaining({
          notification: expect.objectContaining({
            title: "Hello",
            body: "World",
          }),
        }),
      );
    });

    it("should publish to a client", async () => {
      const mock = getMockAblyRest();

      const { stderr } = await runCommand(
        ["push:publish", "--client-id", "client-1", "--title", "Hi"],
        import.meta.url,
      );

      expect(stderr).toContain("published");
      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { clientId: "client-1" },
        expect.objectContaining({
          notification: expect.objectContaining({ title: "Hi" }),
        }),
      );
    });

    it("should publish with full payload", async () => {
      const mock = getMockAblyRest();
      const payload =
        '{"notification":{"title":"Custom"},"data":{"key":"val"}}';

      const { stderr } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--payload", payload],
        import.meta.url,
      );

      expect(stderr).toContain("published");
      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "dev-1" },
        expect.objectContaining({
          notification: { title: "Custom" },
          data: { key: "val" },
        }),
      );
    });

    it("should publish via channel wrapping payload in extras.push", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("my-channel");

      const { stderr } = await runCommand(
        [
          "push:publish",
          "--channel",
          "my-channel",
          "--title",
          "Hello",
          "--body",
          "World",
          "--force",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("published");
      expect(channel.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          extras: {
            push: expect.objectContaining({
              notification: expect.objectContaining({
                title: "Hello",
                body: "World",
              }),
            }),
          },
        }),
      );
      expect(mock.push.admin.publish).not.toHaveBeenCalled();
    });

    it("should ignore --channel when --device-id is also provided", async () => {
      const mock = getMockAblyRest();

      const { stdout, stderr } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "dev-1",
          "--channel",
          "my-channel",
          "--title",
          "Hello",
        ],
        import.meta.url,
      );

      expect(stdout + stderr).toContain("ignored");
      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "dev-1" },
        expect.anything(),
      );
      expect(
        mock.channels._getChannel("my-channel").publish,
      ).not.toHaveBeenCalled();
    });

    it("should output JSON when requested", async () => {
      const { stdout } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--title", "Hi", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("notification");
      expect(result.notification).toHaveProperty("published", true);
    });

    it("should output JSON with channel when publishing via channel", async () => {
      const { stdout } = await runCommand(
        [
          "push:publish",
          "--channel",
          "my-channel",
          "--title",
          "Hi",
          "--json",
          "--force",
        ],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("notification");
      expect(result.notification).toHaveProperty("published", true);
      expect(result.notification).toHaveProperty("channel", "my-channel");
    });

    it("should include string message data when publishing via channel", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("my-channel");

      await runCommand(
        [
          "push:publish",
          "--channel",
          "my-channel",
          "--title",
          "Hello",
          "--message",
          "hello-world",
          "--force",
        ],
        import.meta.url,
      );

      expect(channel.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          data: "hello-world",
          extras: {
            push: expect.objectContaining({
              notification: expect.objectContaining({ title: "Hello" }),
            }),
          },
        }),
      );
    });

    it("should parse JSON message data when publishing via channel", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("my-channel");

      await runCommand(
        [
          "push:publish",
          "--channel",
          "my-channel",
          "--title",
          "Hello",
          "--message",
          '{"key":"val"}',
          "--force",
        ],
        import.meta.url,
      );

      expect(channel.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { key: "val" },
          extras: {
            push: expect.objectContaining({
              notification: expect.objectContaining({ title: "Hello" }),
            }),
          },
        }),
      );
    });

    it("should unwrap the inner value when --message has a top-level data key", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("my-channel");

      await runCommand(
        [
          "push:publish",
          "--channel",
          "my-channel",
          "--title",
          "Hi",
          "--message",
          '{"data":"extracted"}',
          "--force",
        ],
        import.meta.url,
      );

      expect(channel.publish).toHaveBeenCalledWith(
        expect.objectContaining({ data: "extracted" }),
      );
    });

    it("should ignore --message when direct recipient overrides --channel", async () => {
      const mock = getMockAblyRest();

      const { stdout, stderr } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "dev-1",
          "--channel",
          "my-channel",
          "--message",
          "hello",
          "--title",
          "Hi",
        ],
        import.meta.url,
      );

      expect(stdout + stderr).toContain("--message is ignored");
      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "dev-1" },
        expect.anything(),
      );
    });

    it("should include messageData in JSON output when --message is used", async () => {
      const { stdout } = await runCommand(
        [
          "push:publish",
          "--channel",
          "my-channel",
          "--title",
          "Hi",
          "--message",
          "hello",
          "--json",
          "--force",
        ],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("notification");
      expect(result.notification).toHaveProperty("published", true);
      expect(result.notification).toHaveProperty("channel", "my-channel");
      expect(result.notification).toHaveProperty("messageData", "hello");
    });

    it("should set message name and data when --message is a full message object", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("my-channel");

      await runCommand(
        [
          "push:publish",
          "--channel",
          "my-channel",
          "--title",
          "Hi",
          "--message",
          '{"name":"alert","data":"Server down"}',
          "--force",
        ],
        import.meta.url,
      );

      expect(channel.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "alert",
          data: "Server down",
          extras: expect.objectContaining({
            push: expect.objectContaining({
              notification: expect.objectContaining({ title: "Hi" }),
            }),
          }),
        }),
      );
    });

    it("should merge user-provided extras with push extras", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("my-channel");

      await runCommand(
        [
          "push:publish",
          "--channel",
          "my-channel",
          "--title",
          "Hi",
          "--message",
          '{"data":"payload","extras":{"headers":{"x-trace":"abc"}}}',
          "--force",
        ],
        import.meta.url,
      );

      const call = channel.publish.mock.calls[0][0];
      expect(call.data).toBe("payload");
      expect(call.extras).toEqual({
        headers: { "x-trace": "abc" },
        push: expect.objectContaining({
          notification: expect.objectContaining({ title: "Hi" }),
        }),
      });
    });

    it("should include messageName and messageData in JSON output for full message object", async () => {
      const { stdout } = await runCommand(
        [
          "push:publish",
          "--channel",
          "my-channel",
          "--title",
          "Hi",
          "--message",
          '{"name":"alert","data":"hi"}',
          "--json",
          "--force",
        ],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result.notification).toHaveProperty("messageName", "alert");
      expect(result.notification).toHaveProperty("messageData", "hi");
    });
  });

  describe("error handling", () => {
    it("should fail when --message is used without --channel", async () => {
      const { error } = await runCommand(
        ["push:publish", "--message", "hello", "--title", "Hi"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain(
        "--message can only be used with --channel",
      );
    });

    it("should fail when --message includes extras.push", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("my-channel");

      const { error } = await runCommand(
        [
          "push:publish",
          "--channel",
          "my-channel",
          "--title",
          "Hi",
          "--message",
          '{"extras":{"push":{"notification":{"title":"x"}}}}',
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain(
        "--message must not include extras.push",
      );
      expect(channel.publish).not.toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.publish.mockRejectedValue(new Error("Publish failed"));

      const { error } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--title", "Hi"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle channel publish errors", async () => {
      const mock = getMockAblyRest();
      mock.channels
        ._getChannel("err-channel")
        .publish.mockRejectedValue(new Error("Channel error"));

      const { error } = await runCommand(
        [
          "push:publish",
          "--channel",
          "err-channel",
          "--title",
          "Hi",
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle --payload with a non-existent bare relative path as invalid JSON", async () => {
      const { error } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "dev-1",
          "--payload",
          "no/such/file.json",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle invalid JSON in --payload", async () => {
      const { error } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--payload", "not-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });

  // In web CLI mode --payload must never read from the server's filesystem.
  // The file-loading shortcut is local-CLI only.
  describe("web CLI file-read restriction", () => {
    let originalWebCliMode: string | undefined;
    let secretFile: string;

    beforeEach(() => {
      originalWebCliMode = process.env.ABLY_WEB_CLI_MODE;
      secretFile = path.join(os.tmpdir(), `vul506-publish-${process.pid}.json`);
      fs.writeFileSync(
        secretFile,
        '{"notification":{"title":"SECRET_FROM_FILE"}}',
      );
    });

    afterEach(() => {
      if (originalWebCliMode === undefined) {
        delete process.env.ABLY_WEB_CLI_MODE;
      } else {
        process.env.ABLY_WEB_CLI_MODE = originalWebCliMode;
      }
      if (fs.existsSync(secretFile)) fs.rmSync(secretFile);
    });

    it("reads a local file payload when NOT in web CLI mode", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.publish.mockImplementation(async () => {});

      const { stderr } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--payload", secretFile],
        import.meta.url,
      );

      expect(stderr).toContain("published");
      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "dev-1" },
        expect.objectContaining({
          notification: { title: "SECRET_FROM_FILE" },
        }),
      );
    });

    it("rejects a server-side file path in web CLI mode without reading it", async () => {
      process.env.ABLY_WEB_CLI_MODE = "true";
      const mock = getMockAblyRest();

      const { error } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--payload", secretFile],
        import.meta.url,
      );

      // A path-like payload is rejected with a clear message and the file
      // contents are never read or published.
      expect(error).toBeDefined();
      expect(error?.message).toContain("not supported in the web CLI");
      expect(mock.push.admin.publish).not.toHaveBeenCalled();
    });

    it("rejects @file payload references in web CLI mode", async () => {
      process.env.ABLY_WEB_CLI_MODE = "true";

      const { error } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--payload", `@${secretFile}`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("not supported in the web CLI");
    });
  });
});
