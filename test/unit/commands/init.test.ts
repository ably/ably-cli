import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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
  const repoDir = path.join(stagingDir, "agent-skills-v0.1.0");
  const skillsRoot = path.join(repoDir, "skills");
  fs.mkdirSync(skillsRoot, { recursive: true });
  for (const name of names) {
    const skillDir = path.join(skillsRoot, name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\n`,
    );
  }
  const stream = tarCreate({ gzip: true, cwd: stagingDir }, [
    "agent-skills-v0.1.0",
  ]);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  fs.rmSync(stagingDir, { recursive: true, force: true });
  return Buffer.concat(chunks);
}

const TEST_RELEASE = {
  tag: "v0.1.0",
  name: "v0.1.0",
  sha: "abc123def456789012345678901234567890abcd",
};

function mockFetchWithTarball(buffer: Buffer): void {
  // Default attestation verification to "passes". Per-test overrides can set
  // __TEST_MOCKS__.verifyAttestation to a function that throws to exercise
  // the failure path (downloader rejects, command surfaces a clear error).
  globalThis.__TEST_MOCKS__ = {
    ...globalThis.__TEST_MOCKS__,
    verifyAttestation: (sha256: string) => ({
      tarballSha256: sha256,
      signerIdentity: `https://github.com/ably/agent-skills/.github/workflows/release.yml@refs/tags/${TEST_RELEASE.tag}`,
    }),
  };
  fetchMock.mockImplementation(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/releases/latest")) {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          tag_name: TEST_RELEASE.tag,
          name: TEST_RELEASE.name,
        }),
      };
    }
    if (url.includes("/git/refs/tags/")) {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          object: { sha: TEST_RELEASE.sha, type: "commit", url: "" },
        }),
      };
    }
    if (url.includes("/attestations/sha256:")) {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          attestations: [{ bundle: { mediaType: "fake-bundle" } }],
        }),
      };
    }
    if (url.includes("/releases/download/")) {
      return {
        ok: true,
        statusText: "OK",
        arrayBuffer: async () =>
          buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ),
      };
    }
    return {
      ok: false,
      status: 404,
      statusText: `Unexpected URL: ${url}`,
    };
  });
}

function findInstallEvent(stdout: string): Record<string, unknown> | undefined {
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.install) return parsed;
    } catch {
      // Not JSON — ignore. NDJSON streams may have non-JSON lines
      // (logo, prompts) in non-JSON mode, but in --json mode all
      // output should be JSON.
    }
  }
  return undefined;
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
      delete (globalThis.__TEST_MOCKS__ as Record<string, unknown>)
        .verifyAttestation;
      delete (globalThis.__TEST_MOCKS__ as Record<string, unknown>)
        .isRunningFromNpx;
      delete (globalThis.__TEST_MOCKS__ as Record<string, unknown>)
        .confirmGlobalInstall;
      delete (globalThis.__TEST_MOCKS__ as Record<string, unknown>)
        .installGlobally;
    }
    vi.restoreAllMocks();
  });

  standardHelpTests("init", import.meta.url);
  standardArgValidationTests("init", import.meta.url);
  standardFlagTests("init", import.meta.url, [
    "--target",
    "--json",
    "--no-install",
  ]);

  describe("functionality", () => {
    it("should install skills to the requested target when already authenticated", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const { error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      // 3 fetches: /releases/latest, /git/refs/tags/<tag>, then the release
      // asset. Attestation verification is short-circuited by the
      // __TEST_MOCKS__.verifyAttestation hook, so the /attestations/sha256:
      // endpoint isn't hit in tests.
      expect(fetchMock).toHaveBeenCalledTimes(3);
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
    it("should delegate to skills:install and surface release-resolution failures", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const { error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /Failed to resolve latest release|Not Found/i,
      );
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
      // The login runner was invoked exactly once with --skip-logo so the
      // Ably ASCII logo isn't printed twice (init prints it).
      expect(recordedArgv).toEqual([["--skip-logo"]]);
    });

    it("should reject --target auto combined with explicit targets", async () => {
      const { error } = await runCommand(
        ["init", "--target", "auto", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /--target auto cannot be combined with explicit targets/i,
      );
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

      expect(recordedArgv).toEqual([
        ["--skip-logo", "--json", "--skip-completed-status"],
      ]);
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

  describe("global install (npx onboarding)", () => {
    // The default test environment looks "not from npx" — these tests have to
    // opt in via __TEST_MOCKS__.isRunningFromNpx to exercise the install path.
    it("should not attempt a global install when not launched via npx", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const installCalls: string[] = [];
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).installGlobally =
        async (pkg: string) => {
          installCalls.push(pkg);
        };

      const { error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(installCalls).toEqual([]);
    });

    it("should not attempt a global install when --no-install is passed (even from npx)", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).isRunningFromNpx =
        true;

      const installCalls: string[] = [];
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).installGlobally =
        async (pkg: string) => {
          installCalls.push(pkg);
        };

      const { error } = await runCommand(
        ["init", "--target", "cursor", "--no-install"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(installCalls).toEqual([]);
    });

    it("should install globally in JSON mode without prompting", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).isRunningFromNpx =
        true;

      const installCalls: string[] = [];
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).installGlobally =
        async (pkg: string) => {
          installCalls.push(pkg);
        };

      const { error } = await runCommand(
        ["init", "--target", "cursor", "--json"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(installCalls).toEqual(["@ably/cli@latest"]);
    });

    it("should install globally in interactive mode when the user confirms", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).isRunningFromNpx =
        true;
      (
        globalThis.__TEST_MOCKS__ as Record<string, unknown>
      ).confirmGlobalInstall = true;

      const installCalls: string[] = [];
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).installGlobally =
        async (pkg: string) => {
          installCalls.push(pkg);
        };

      const { stderr, error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(installCalls).toEqual(["@ably/cli@latest"]);
      expect(stderr).toMatch(/Installed @ably\/cli globally/);
    });

    it("should skip install and warn when the user declines the prompt", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).isRunningFromNpx =
        true;
      (
        globalThis.__TEST_MOCKS__ as Record<string, unknown>
      ).confirmGlobalInstall = false;

      const installCalls: string[] = [];
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).installGlobally =
        async (pkg: string) => {
          installCalls.push(pkg);
        };

      const { stderr, error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(installCalls).toEqual([]);
      expect(stderr).toMatch(/Skipping global install/);
    });

    it("should warn rather than fail when the global install command errors (non-JSON)", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).isRunningFromNpx =
        true;
      (
        globalThis.__TEST_MOCKS__ as Record<string, unknown>
      ).confirmGlobalInstall = true;
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).installGlobally =
        async () => {
          throw new Error("EACCES: permission denied");
        };

      const { stderr, stdout, error } = await runCommand(
        ["init", "--target", "cursor"],
        import.meta.url,
      );

      // Install failure must not be fatal — the rest of init (auth, skills)
      // is still useful, and the user can run `npm install -g` themselves.
      expect(error).toBeUndefined();
      // Non-JSON mode: terse warning. npm would have printed the real error
      // to inherited stderr in production, so we don't restate it.
      expect(stderr).toMatch(
        /Could not install @ably\/cli globally\. Run: npm install -g @ably\/cli/,
      );
      // Specifically should NOT include the raw error detail in non-JSON mode.
      expect(stderr).not.toMatch(/EACCES/);
      expect(stdout).not.toMatch(/EACCES/);
    });

    it("should surface captured stderr in the JSON-mode failure warning", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).isRunningFromNpx =
        true;
      (globalThis.__TEST_MOCKS__ as Record<string, unknown>).installGlobally =
        async () => {
          throw new Error("EACCES: permission denied at /usr/local/lib");
        };

      const { stdout, error } = await runCommand(
        ["init", "--target", "cursor", "--json"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      // JSON mode emits the warning as a structured NDJSON line via
      // logWarning. The captured stderr (the thrown error's message in the
      // test hook case) should be embedded so agents see why install failed.
      expect(stdout).toMatch(/EACCES: permission denied at \/usr\/local\/lib/);
    });

    // Agents driving `ably init --json` need a structured signal for the
    // install step's outcome. logProgress / logSuccessMessage are silent in
    // JSON mode by design, so without a dedicated event the install step is
    // invisible unless it fails. We emit one `install` event per init run.
    describe("JSON install events", () => {
      it("emits status=installed on a successful global install", async () => {
        mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
        (
          globalThis.__TEST_MOCKS__ as Record<string, unknown>
        ).isRunningFromNpx = true;
        (globalThis.__TEST_MOCKS__ as Record<string, unknown>).installGlobally =
          async () => {};

        const { stdout, error } = await runCommand(
          ["init", "--target", "cursor", "--json"],
          import.meta.url,
        );

        expect(error).toBeUndefined();
        const event = findInstallEvent(stdout);
        expect(event?.install).toEqual({
          status: "installed",
          package: "@ably/cli@latest",
        });
      });

      it("emits status=skipped reason=no-install-flag when --no-install is passed", async () => {
        mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
        (
          globalThis.__TEST_MOCKS__ as Record<string, unknown>
        ).isRunningFromNpx = true;

        const { stdout, error } = await runCommand(
          ["init", "--target", "cursor", "--json", "--no-install"],
          import.meta.url,
        );

        expect(error).toBeUndefined();
        const event = findInstallEvent(stdout);
        expect(event?.install).toEqual({
          status: "skipped",
          reason: "no-install-flag",
        });
      });

      it("emits status=skipped reason=not-npx when --no-install is passed outside npx", async () => {
        // The flag is only meaningful in the npx flow. From a globally
        // installed binary, the more accurate reason for skipping is that
        // we're not in npx — not the flag.
        mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
        // No isRunningFromNpx override → defaults to false.

        const { stdout, error } = await runCommand(
          ["init", "--target", "cursor", "--json", "--no-install"],
          import.meta.url,
        );

        expect(error).toBeUndefined();
        const event = findInstallEvent(stdout);
        expect(event?.install).toEqual({
          status: "skipped",
          reason: "not-npx",
        });
      });

      it("emits status=skipped reason=not-npx when running outside npx", async () => {
        mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
        // Don't set isRunningFromNpx — default is false.

        const { stdout, error } = await runCommand(
          ["init", "--target", "cursor", "--json"],
          import.meta.url,
        );

        expect(error).toBeUndefined();
        const event = findInstallEvent(stdout);
        expect(event?.install).toEqual({
          status: "skipped",
          reason: "not-npx",
        });
      });

      it("emits status=failed with error details when install throws", async () => {
        mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));
        (
          globalThis.__TEST_MOCKS__ as Record<string, unknown>
        ).isRunningFromNpx = true;
        (globalThis.__TEST_MOCKS__ as Record<string, unknown>).installGlobally =
          async () => {
            throw new Error("EACCES: permission denied");
          };

        const { stdout, error } = await runCommand(
          ["init", "--target", "cursor", "--json"],
          import.meta.url,
        );

        expect(error).toBeUndefined();
        const event = findInstallEvent(stdout);
        const install = event?.install as
          | { status: string; package: string; error: { message: string } }
          | undefined;
        expect(install?.status).toBe("failed");
        expect(install?.package).toBe("@ably/cli@latest");
        expect(install?.error.message).toMatch(/EACCES/);
      });
    });
  });
});
