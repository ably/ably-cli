import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";

describe("push:batch-publish command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.request.mockReset();
    mock.request.mockResolvedValue({
      items: [],
      statusCode: 200,
      success: true,
    });
  });

  describe("successful batch publish", () => {
    it("should publish batch notifications with inline JSON", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        items: [{}, {}],
        statusCode: 200,
        success: true,
      });

      const batchPayload = JSON.stringify([
        {
          recipient: { deviceId: "device-1" },
          payload: { notification: { title: "Hello 1" } },
        },
        {
          recipient: { deviceId: "device-2" },
          payload: { notification: { title: "Hello 2" } },
        },
      ]);

      const { stdout } = await runCommand(
        ["push:batch-publish", "--payload", batchPayload],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledWith(
        "POST",
        "/push/batch/publish",
        2,
        {},
        expect.arrayContaining([
          expect.objectContaining({
            recipient: { deviceId: "device-1" },
            payload: { notification: { title: "Hello 1" } },
          }),
          expect.objectContaining({
            recipient: { deviceId: "device-2" },
            payload: { notification: { title: "Hello 2" } },
          }),
        ]),
        {},
      );
      expect(stdout).toContain("2");
      expect(stdout).toContain("Successful");
    });

    it("should handle mixed results (some failures)", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        items: [{}, { error: { message: "Device not found", code: 40400 } }],
        statusCode: 200,
        success: true,
      });

      const batchPayload = JSON.stringify([
        {
          recipient: { deviceId: "device-1" },
          payload: { notification: { title: "Hello 1" } },
        },
        {
          recipient: { deviceId: "non-existent" },
          payload: { notification: { title: "Hello 2" } },
        },
      ]);

      const { stdout } = await runCommand(
        ["push:batch-publish", "--payload", batchPayload],
        import.meta.url,
      );

      expect(stdout).toContain("Successful");
      expect(stdout).toContain("Failed");
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        items: [{}, {}],
        statusCode: 200,
        success: true,
      });

      const batchPayload = JSON.stringify([
        {
          recipient: { deviceId: "device-1" },
          payload: { notification: { title: "Hello 1" } },
        },
        {
          recipient: { clientId: "client-1" },
          payload: { notification: { title: "Hello 2" } },
        },
      ]);

      const { stdout } = await runCommand(
        ["push:batch-publish", "--payload", batchPayload, "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.total).toBe(2);
      expect(output.successful).toBe(2);
      expect(output.failed).toBe(0);
      expect(output.results).toHaveLength(2);
    });

    it("should support client ID recipients", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        items: [{}],
        statusCode: 200,
        success: true,
      });

      const batchPayload = JSON.stringify([
        {
          recipient: { clientId: "user-123" },
          payload: { notification: { title: "User notification" } },
        },
      ]);

      const { stdout } = await runCommand(
        ["push:batch-publish", "--payload", batchPayload],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledWith(
        "POST",
        "/push/batch/publish",
        2,
        {},
        expect.arrayContaining([
          expect.objectContaining({
            recipient: { clientId: "user-123" },
          }),
        ]),
        {},
      );
      expect(stdout).toContain("Successful");
    });
  });

  describe("validation", () => {
    it("should require --payload flag", async () => {
      const { error } = await runCommand(
        ["push:batch-publish"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/missing.*required.*flag.*payload/i);
    });

    it("should reject empty batch payload", async () => {
      const { error } = await runCommand(
        ["push:batch-publish", "--payload", "[]"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/empty/i);
    });

    it("should reject invalid JSON", async () => {
      const { error } = await runCommand(
        ["push:batch-publish", "--payload", "[{invalid-json}]"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/invalid json/i);
    });

    it("should reject non-array JSON", async () => {
      const { error } = await runCommand(
        ["push:batch-publish", "--payload", '{"not":"array"}'],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/must be.*json array/i);
    });

    it("should reject items without recipient", async () => {
      const batchPayload = JSON.stringify([
        { payload: { notification: { title: "Hello" } } },
      ]);

      const { error } = await runCommand(
        ["push:batch-publish", "--payload", batchPayload],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/missing.*recipient/i);
    });

    it("should reject items without recipient deviceId or clientId", async () => {
      const batchPayload = JSON.stringify([
        {
          recipient: {},
          payload: { notification: { title: "Hello" } },
        },
      ]);

      const { error } = await runCommand(
        ["push:batch-publish", "--payload", batchPayload],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/deviceId.*clientId/i);
    });

    it("should reject items without payload", async () => {
      const batchPayload = JSON.stringify([
        { recipient: { deviceId: "device-1" } },
      ]);

      const { error } = await runCommand(
        ["push:batch-publish", "--payload", batchPayload],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/missing.*payload/i);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("API Error"));

      const batchPayload = JSON.stringify([
        {
          recipient: { deviceId: "device-1" },
          payload: { notification: { title: "Hello" } },
        },
      ]);

      const { error } = await runCommand(
        ["push:batch-publish", "--payload", batchPayload],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should report file not found error", async () => {
      const { error } = await runCommand(
        ["push:batch-publish", "--payload", "/non/existent/file.json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/file not found/i);
    });
  });
});
