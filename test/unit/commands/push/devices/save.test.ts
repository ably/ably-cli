import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("push:devices:save command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:devices:save", import.meta.url);
  standardArgValidationTests("push:devices:save", import.meta.url);
  standardFlagTests("push:devices:save", import.meta.url, [
    "--json",
    "--id",
    "--platform",
    "--form-factor",
    "--transport-type",
    "--device-token",
    "--target-url",
    "--p256dh-key",
    "--auth-secret",
  ]);

  describe("functionality", () => {
    it("should save a device with inline flags", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "device-1",
        platform: "ios",
      });

      const { stderr } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Device registration saved");
      expect(mock.push.admin.deviceRegistrations.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "device-1",
          platform: "ios",
          formFactor: "phone",
        }),
      );
    });

    it("should save a device with --data JSON", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "device-2",
      });

      const { stderr } = await runCommand(
        [
          "push:devices:save",
          "--data",
          '{"id":"device-2","platform":"android","formFactor":"tablet","push":{"recipient":{"transportType":"fcm","registrationToken":"tok"}}}',
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Device registration saved");
    });

    it("should output JSON when requested", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "device-1",
      });

      const { stdout } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
          "--json",
        ],
        import.meta.url,
      );

      // Parse NDJSON output — find the result record
      const records = stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const result = records.find((r) => r.type === "result");
      expect(result).toBeDefined();
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("device");
    });

    it("should save a web push device with inline flags", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "browser-1",
        platform: "browser",
      });

      const { stderr } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "browser-1",
          "--platform",
          "browser",
          "--form-factor",
          "desktop",
          "--transport-type",
          "web",
          "--target-url",
          "https://push.example.com",
          "--p256dh-key",
          "BNcRdreALRFX...",
          "--auth-secret",
          "tBHItJI5svbpC...",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Device registration saved");
      expect(mock.push.admin.deviceRegistrations.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "browser-1",
          platform: "browser",
          formFactor: "desktop",
          push: {
            recipient: {
              transportType: "web",
              targetUrl: "https://push.example.com",
              encryptionKey: {
                p256dh: "BNcRdreALRFX...",
                auth: "tBHItJI5svbpC...",
              },
            },
          },
        }),
      );
    });
  });

  describe("argument validation", () => {
    it("should require web push flags for web transport", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "browser-1",
          "--platform",
          "browser",
          "--form-factor",
          "desktop",
          "--transport-type",
          "web",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should require --device-token for apns transport", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should require --id when not using --data", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockRejectedValue(
        new Error("Save failed"),
      );

      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle invalid JSON in --data", async () => {
      const { error } = await runCommand(
        ["push:devices:save", "--data", "not-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should reject non-object --metadata (string)", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
          "--metadata",
          "42",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("must be a JSON object");
    });

    it("should reject non-object --metadata (array)", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
          "--metadata",
          "[1,2,3]",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("must be a JSON object");
    });
  });

  // In web CLI mode --data must never be read from the server's filesystem.
  // The @file shortcut is local-CLI only.
  describe("web CLI file-read restriction", () => {
    let originalWebCliMode: string | undefined;
    let secretFile: string;

    beforeEach(() => {
      originalWebCliMode = process.env.ABLY_WEB_CLI_MODE;
      secretFile = path.join(os.tmpdir(), `vul506-device-${process.pid}.json`);
      fs.writeFileSync(
        secretFile,
        '{"id":"device-2","platform":"android","formFactor":"tablet","push":{"recipient":{"transportType":"fcm","registrationToken":"tok"}}}',
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

    it("reads a local --data @file when NOT in web CLI mode", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "device-2",
      });

      const { stderr } = await runCommand(
        ["push:devices:save", "--data", `@${secretFile}`],
        import.meta.url,
      );

      expect(stderr).toContain("Device registration saved");
      expect(mock.push.admin.deviceRegistrations.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: "device-2", platform: "android" }),
      );
    });

    it("reads a local --data path input when NOT in web CLI mode", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "device-2",
      });

      const { stderr } = await runCommand(
        ["push:devices:save", "--data", secretFile],
        import.meta.url,
      );

      expect(stderr).toContain("Device registration saved");
      expect(mock.push.admin.deviceRegistrations.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: "device-2", platform: "android" }),
      );
    });

    it("rejects --data @file references in web CLI mode", async () => {
      process.env.ABLY_WEB_CLI_MODE = "true";
      const mock = getMockAblyRest();

      const { error } = await runCommand(
        ["push:devices:save", "--data", `@${secretFile}`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("not supported in the web CLI");
      expect(mock.push.admin.deviceRegistrations.save).not.toHaveBeenCalled();
    });

    it("rejects a --data path input in web CLI mode without reading it", async () => {
      process.env.ABLY_WEB_CLI_MODE = "true";
      const mock = getMockAblyRest();

      const { error } = await runCommand(
        ["push:devices:save", "--data", secretFile],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("not supported in the web CLI");
      expect(mock.push.admin.deviceRegistrations.save).not.toHaveBeenCalled();
    });
  });
});
