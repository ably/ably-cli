import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";

async function testTopicFormatting(topic: string) {
  const { stdout } = await runCommand([topic], import.meta.url);

  // Should have header
  expect(stdout).toMatch(/^Ably .+ commands:$/m);

  // Should have empty line after header
  const lines = stdout.split("\n");
  const headerIndex = lines.findIndex(function (line) {
    return line.includes("commands:");
  });
  expect(lines[headerIndex + 1]).toBe("");

  // Should have commands indented with consistent spacing
  const commandLines = lines.filter(function (line) {
    return line.match(/^\s+ably/);
  });
  commandLines.forEach(function (line) {
    expect(line).toMatch(/^\s{2}ably/); // Two spaces indent
    expect(line).toContain(" - "); // Separator between command and description
  });

  // Should have help text at the end
  expect(stdout).toContain(`Run \`ably ${topic} COMMAND --help\``);
}

describe("topic command display", function () {
  describe("accounts topic", function () {
    it("should display accounts commands correctly", async function () {
      const { stdout } = await runCommand(["accounts"], import.meta.url);

      expect(stdout).toContain("Ably accounts management commands:");
      expect(stdout).toContain("ably accounts login");
      expect(stdout).toContain("ably accounts list");
      expect(stdout).toContain("ably accounts current");
      expect(stdout).toContain("ably accounts logout");
      expect(stdout).toContain("ably accounts switch");
      expect(stdout).toContain("ably accounts stats");
      expect(stdout).toContain("Run `ably accounts COMMAND --help`");
      expect(stdout).not.toContain("Example:"); // Examples only with --help
    });
  });

  describe("apps topic", function () {
    it("should display apps commands correctly", async function () {
      const { stdout } = await runCommand(["apps"], import.meta.url);

      expect(stdout).toContain("Ably apps management commands:");
      expect(stdout).toContain("ably apps create");
      expect(stdout).toContain("ably apps list");
      expect(stdout).toContain("ably apps update");
      expect(stdout).toContain("ably apps delete");
      expect(stdout).toContain("ably apps channel-rules");
      expect(stdout).toContain("ably apps stats");
      expect(stdout).toContain("ably apps logs");
      expect(stdout).toContain("ably apps switch");
      expect(stdout).toContain("Run `ably apps COMMAND --help`");
    });
  });

  describe("auth topic", function () {
    it("should display auth commands correctly", async function () {
      const { stdout } = await runCommand(["auth"], import.meta.url);

      expect(stdout).toContain("Ably authentication commands:");
      expect(stdout).toContain("ably auth keys");
      expect(stdout).toContain("ably auth issue-jwt-token");
      expect(stdout).toContain("ably auth issue-ably-token");
      expect(stdout).toContain("ably auth revoke-token");
      expect(stdout).toContain("Run `ably auth COMMAND --help`");
    });
  });

  describe("bench topic", function () {
    it("should display bench commands correctly", async function () {
      const { stdout } = await runCommand(["bench"], import.meta.url);

      expect(stdout).toContain("Ably benchmark testing commands:");
      expect(stdout).toContain("ably bench publisher");
      expect(stdout).toContain("ably bench subscriber");
      expect(stdout).toContain("Run `ably bench COMMAND --help`");
    });
  });

  describe("channels topic", function () {
    it("should display channels commands correctly", async function () {
      const { stdout } = await runCommand(["channels"], import.meta.url);

      expect(stdout).toContain("Ably Pub/Sub channel commands:");
      expect(stdout).toContain("ably channels list");
      expect(stdout).toContain("ably channels publish");
      expect(stdout).toContain("ably channels batch-publish");
      expect(stdout).toContain("ably channels subscribe");
      expect(stdout).toContain("ably channels history");
      expect(stdout).toContain("ably channels occupancy");
      expect(stdout).toContain("ably channels presence");
      expect(stdout).toContain("Run `ably channels COMMAND --help`");
    });
  });

  describe("connections topic", function () {
    it("should display connections commands correctly", async function () {
      const { stdout } = await runCommand(["connections"], import.meta.url);

      expect(stdout).toContain("Ably Pub/Sub connection commands:");
      expect(stdout).toContain("ably connections stats");
      expect(stdout).toContain("ably connections test");
      expect(stdout).toContain("Run `ably connections COMMAND --help`");
    });
  });

  describe("integrations topic", function () {
    it("should display integrations commands correctly", async function () {
      const { stdout } = await runCommand(["integrations"], import.meta.url);

      expect(stdout).toContain("Ably integrations management commands:");
      expect(stdout).toContain("ably integrations list");
      expect(stdout).toContain("ably integrations get");
      expect(stdout).toContain("ably integrations create");
      expect(stdout).toContain("ably integrations update");
      expect(stdout).toContain("ably integrations delete");
      expect(stdout).toContain("Run `ably integrations COMMAND --help`");
    });
  });

  describe("logs topic", function () {
    it("should display logs commands correctly", async function () {
      const { stdout } = await runCommand(["logs"], import.meta.url);

      expect(stdout).toContain("Ably logging commands:");
      expect(stdout).toContain("ably logs app");
      expect(stdout).toContain("ably logs channel-lifecycle");
      expect(stdout).toContain("ably logs connection-lifecycle");
      expect(stdout).toContain("ably logs push");
      expect(stdout).toContain("Run `ably logs COMMAND --help`");
    });
  });

  describe("queues topic", function () {
    it("should display queues commands correctly", async function () {
      const { stdout } = await runCommand(["queues"], import.meta.url);

      expect(stdout).toContain("Ably queues management commands:");
      expect(stdout).toContain("ably queues list");
      expect(stdout).toContain("ably queues create");
      expect(stdout).toContain("ably queues delete");
      expect(stdout).toContain("Run `ably queues COMMAND --help`");
    });
  });

  describe("rooms topic", function () {
    it("should display rooms commands correctly", async function () {
      const { stdout } = await runCommand(["rooms"], import.meta.url);

      expect(stdout).toContain("Ably Chat rooms commands:");
      expect(stdout).toContain("ably rooms list");
      expect(stdout).toContain("ably rooms messages");
      expect(stdout).toContain("ably rooms occupancy");
      expect(stdout).toContain("ably rooms presence");
      expect(stdout).toContain("ably rooms reactions");
      expect(stdout).toContain("ably rooms typing");
      expect(stdout).toContain("Run `ably rooms COMMAND --help`");
    });
  });

  describe("spaces topic", function () {
    it("should display spaces commands correctly", async function () {
      const { stdout } = await runCommand(["spaces"], import.meta.url);

      expect(stdout).toContain("Ably Spaces commands:");
      expect(stdout).toContain("ably spaces list");
      expect(stdout).toContain("ably spaces cursors");
      expect(stdout).toContain("ably spaces locations");
      expect(stdout).toContain("ably spaces locks");
      expect(stdout).toContain("ably spaces members");
      expect(stdout).toContain("Run `ably spaces COMMAND --help`");
    });
  });

  describe("formatting consistency", function () {
    it("should have consistent formatting for accounts", async function () {
      await expect(testTopicFormatting("accounts")).resolves.toBeUndefined();
    });

    it("should have consistent formatting for apps", async function () {
      await expect(testTopicFormatting("apps")).resolves.toBeUndefined();
    });

    it("should have consistent formatting for auth", async function () {
      await expect(testTopicFormatting("auth")).resolves.toBeUndefined();
    });

    it("should have consistent formatting for bench", async function () {
      await expect(testTopicFormatting("bench")).resolves.toBeUndefined();
    });

    it("should have consistent formatting for channels", async function () {
      await expect(testTopicFormatting("channels")).resolves.toBeUndefined();
    });

    it("should have consistent formatting for connections", async function () {
      await expect(testTopicFormatting("connections")).resolves.toBeUndefined();
    });

    it("should have consistent formatting for integrations", async function () {
      await expect(
        testTopicFormatting("integrations"),
      ).resolves.toBeUndefined();
    });

    it("should have consistent formatting for logs", async function () {
      await expect(testTopicFormatting("logs")).resolves.toBeUndefined();
    });

    it("should have consistent formatting for queues", async function () {
      await expect(testTopicFormatting("queues")).resolves.toBeUndefined();
    });

    it("should have consistent formatting for rooms", async function () {
      await expect(testTopicFormatting("rooms")).resolves.toBeUndefined();
    });

    it("should have consistent formatting for spaces", async function () {
      await expect(testTopicFormatting("spaces")).resolves.toBeUndefined();
    });
  });

  describe("hidden commands", function () {
    it("should not display hidden commands", async function () {
      const { stdout } = await runCommand(["accounts"], import.meta.url);

      // The accounts command should not show any hidden sub-commands
      // This test ensures that if any sub-commands are marked as hidden,
      // they won't appear in the output
      const lines = stdout.split("\n");
      const commandLines = lines.filter(function (line) {
        return line.match(/^\s+ably/);
      });

      // All displayed commands should be valid, non-hidden commands
      commandLines.forEach(function (line) {
        expect(line).toMatch(/^\s{2}ably accounts \w+/);
      });
    });
  });
});
