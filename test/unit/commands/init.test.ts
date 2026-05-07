import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { create as tarCreate } from "tar";
import {
  type DetectedTool,
  InstallMethod,
} from "../../../src/services/tool-detector.js";
import { getMockConfigManager } from "../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../helpers/standard-tests.js";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as typeof fetch;

// State for the prompt-stubbing test hook in init.ts and the tool-detector
// test hook. Tests set these in beforeEach; the source modules read them via
// globalThis.__TEST_MOCKS__.
const detectorState: { tools: DetectedTool[] } = { tools: [] };

const ALL_UNDETECTED: DetectedTool[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    detected: false,
    evidence: "",
    installMethod: InstallMethod.Plugin,
  },
  {
    id: "cursor",
    name: "Cursor",
    detected: false,
    evidence: "",
    installMethod: InstallMethod.FileCopy,
  },
  {
    id: "vscode",
    name: "VS Code",
    detected: false,
    evidence: "",
    installMethod: InstallMethod.FileCopy,
  },
  {
    id: "windsurf",
    name: "Windsurf",
    detected: false,
    evidence: "",
    installMethod: InstallMethod.FileCopy,
  },
];

async function buildSkillsTarball(...names: string[]): Promise<Buffer> {
  const stagingDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "init-skills-stage-"),
  );
  const repoDir = path.join(stagingDir, "agent-skills-main");
  fs.mkdirSync(repoDir, { recursive: true });
  for (const name of names) {
    const skillDir = path.join(repoDir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\n`,
    );
  }
  const stream = tarCreate({ gzip: true, cwd: stagingDir }, [
    "agent-skills-main",
  ]);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  fs.rmSync(stagingDir, { recursive: true, force: true });
  return Buffer.concat(chunks);
}

function mockFetchWithTarball(buffer: Buffer): void {
  fetchMock.mockImplementation(
    async () =>
      ({
        ok: true,
        statusText: "OK",
        body: Readable.toWeb(Readable.from(buffer)),
      }) as unknown as Response,
  );
}

describe("init command", () => {
  let tempDir: string;
  let originalCwd: string;
  let originalHome: string | undefined;
  let originalPath: string | undefined;
  let originalAccessToken: string | undefined;
  let originalStdoutIsTTY: boolean | undefined;
  let originalStdinIsTTY: boolean | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "init-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
    // Hide the host's `claude` CLI so the plugin install path is not exercised.
    originalPath = process.env.PATH;
    process.env.PATH = tempDir;
    // Skip the auth flow — the happy path tests focus on skill installation.
    originalAccessToken = process.env.ABLY_ACCESS_TOKEN;
    process.env.ABLY_ACCESS_TOKEN = "test-access-token";

    originalStdoutIsTTY = process.stdout.isTTY;
    originalStdinIsTTY = process.stdin.isTTY;

    fetchMock.mockReset();
    detectorState.tools = ALL_UNDETECTED;
    globalThis.__TEST_MOCKS__ = {
      ...globalThis.__TEST_MOCKS__,
      detectTools: () => Promise.resolve(detectorState.tools),
    };
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
    if (originalAccessToken === undefined) {
      delete process.env.ABLY_ACCESS_TOKEN;
    } else {
      process.env.ABLY_ACCESS_TOKEN = originalAccessToken;
    }
    if (originalStdoutIsTTY === undefined) {
      delete (process.stdout as { isTTY?: boolean }).isTTY;
    } else {
      process.stdout.isTTY = originalStdoutIsTTY;
    }
    if (originalStdinIsTTY === undefined) {
      delete (process.stdin as { isTTY?: boolean }).isTTY;
    } else {
      process.stdin.isTTY = originalStdinIsTTY;
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (globalThis.__TEST_MOCKS__) {
      delete (globalThis.__TEST_MOCKS__ as Record<string, unknown>).detectTools;
      delete (globalThis.__TEST_MOCKS__ as Record<string, unknown>)
        .checkboxResponse;
      delete (globalThis.__TEST_MOCKS__ as Record<string, unknown>).runLogin;
    }
    vi.restoreAllMocks();
  });

  standardHelpTests("init", import.meta.url);
  standardArgValidationTests("init", import.meta.url);
  standardFlagTests("init", import.meta.url, ["--target", "--json"]);

  describe("functionality", () => {
    it("should install skills to the requested target when already authenticated", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const { error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(
        fs.existsSync(
          path.join(tempDir, ".cursor", "skills", "ably-pubsub", "SKILL.md"),
        ),
      ).toBe(true);
    });

    it("should emit structured JSON describing the install with --json", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const { stdout, error } = await runCommand(
        ["init", "--target", "cursor", "--json"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      const lines = stdout.trim().split("\n");
      const resultLine = lines.find((line) => {
        try {
          return (JSON.parse(line) as { type?: string }).type === "result";
        } catch {
          return false;
        }
      });
      expect(resultLine).toBeDefined();
      const record = JSON.parse(resultLine!) as {
        type: string;
        success: boolean;
        installation: {
          installed: Array<{ target: string; skillCount: number }>;
        };
      };
      expect(record.type).toBe("result");
      expect(record.success).toBe(true);
      expect(record.installation.installed).toHaveLength(1);
      expect(record.installation.installed[0]!.target).toBe("cursor");
      expect(record.installation.installed[0]!.skillCount).toBe(1);
    });
  });

  describe("error handling", () => {
    it("should delegate to skills:install and surface download failures", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      } as Response);

      const { error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Failed to download skills|Not Found/i);
    });
  });

  describe("authentication", () => {
    it("should treat stored config token as already-authenticated", async () => {
      // Drop the env-var path so hasControlApiAccess() must check
      // configManager.getAccessToken() — MockConfigManager provides one by default.
      delete process.env.ABLY_ACCESS_TOKEN;
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const { stderr, error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(stderr).toMatch(/Already authenticated/i);
      expect(
        fs.existsSync(
          path.join(tempDir, ".cursor", "skills", "ably-pubsub", "SKILL.md"),
        ),
      ).toBe(true);
    });

    it("should delegate to accounts:login when neither env var nor stored token is set", async () => {
      // Drop both auth sources so hasControlApiAccess() returns false and
      // runAuth() must fall through to the accounts:login delegation.
      delete process.env.ABLY_ACCESS_TOKEN;
      getMockConfigManager().clearAccounts();
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const recordedArgv: string[][] = [];
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).runLogin = async (
        argv: string[],
      ) => {
        recordedArgv.push(argv);
      };

      const { stdout, error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      // The "Authenticate with Ably" heading is only printed by the unauth branch
      // of runAuth(). Its presence proves we delegated rather than skipping.
      expect(stdout).toMatch(/Authenticate with Ably/);
      // The login runner was invoked exactly once, with no extra flags.
      expect(recordedArgv).toEqual([[]]);
    });

    it("should pass --json through to accounts:login when delegating", async () => {
      delete process.env.ABLY_ACCESS_TOKEN;
      getMockConfigManager().clearAccounts();
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const recordedArgv: string[][] = [];
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).runLogin = async (
        argv: string[],
      ) => {
        recordedArgv.push(argv);
      };

      await runCommand(
        ["init", "--target", "cursor", "--json"],
        import.meta.url,
      );

      expect(recordedArgv).toEqual([["--json"]]);
    });

    it("should surface accounts:login failures via this.fail", async () => {
      delete process.env.ABLY_ACCESS_TOKEN;
      getMockConfigManager().clearAccounts();

      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).runLogin =
        async () => {
          throw new Error("device authorization denied");
        };

      const { error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/device authorization denied/i);
    });
  });

  describe("interactive prompt", () => {
    it("should skip skill install when no tools are detected", async () => {
      // Force interactive mode so promptForTargets() runs.
      process.stdout.isTTY = true;
      process.stdin.isTTY = true;
      // detectorState.tools defaults to ALL_UNDETECTED in beforeEach.

      const { stdout, stderr, error } = await runCommand(
        ["init"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(stderr).toMatch(/No AI coding tools detected/i);
      // Getting started block should still be shown.
      expect(stdout).toMatch(/Getting started with the Ably CLI/);
      // No skills install should have happened — no fetch, no skill files.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should warn and skip install when user picks zero editors", async () => {
      process.stdout.isTTY = true;
      process.stdin.isTTY = true;
      detectorState.tools = [
        {
          id: "cursor",
          name: "Cursor",
          detected: true,
          evidence: "config: ~/.cursor",
          installMethod: InstallMethod.FileCopy,
        },
        ...ALL_UNDETECTED.filter((t) => t.id !== "cursor"),
      ];
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).checkboxResponse =
        [];

      const { stderr, error } = await runCommand(["init"], import.meta.url);

      expect(error).toBeUndefined();
      expect(stderr).toMatch(/No editors selected/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should treat prompt cancellation as null and skip install", async () => {
      process.stdout.isTTY = true;
      process.stdin.isTTY = true;
      detectorState.tools = [
        {
          id: "cursor",
          name: "Cursor",
          detected: true,
          evidence: "config: ~/.cursor",
          installMethod: InstallMethod.FileCopy,
        },
        ...ALL_UNDETECTED.filter((t) => t.id !== "cursor"),
      ];
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).checkboxResponse =
        "throw";

      const { stdout, error } = await runCommand(["init"], import.meta.url);

      expect(error).toBeUndefined();
      expect(stdout).toMatch(/Getting started with the Ably CLI/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should install skills for editor(s) the user picks", async () => {
      process.stdout.isTTY = true;
      process.stdin.isTTY = true;
      detectorState.tools = [
        {
          id: "cursor",
          name: "Cursor",
          detected: true,
          evidence: "config: ~/.cursor",
          installMethod: InstallMethod.FileCopy,
        },
        ...ALL_UNDETECTED.filter((t) => t.id !== "cursor"),
      ];
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).checkboxResponse =
        ["cursor"];
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const { error } = await runCommand(["init"], import.meta.url);

      expect(error).toBeUndefined();
      expect(
        fs.existsSync(
          path.join(tempDir, ".cursor", "skills", "ably-pubsub", "SKILL.md"),
        ),
      ).toBe(true);
    });
  });
});
