import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { create as tarCreate } from "tar";

import {
  type DetectedTool,
  InstallMethod,
} from "../../../../src/services/tool-detector.js";
import {
  type PluginInstallResult,
  PluginInstallStatus,
} from "../../../../src/services/claude-plugin-installer.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as typeof fetch;

// Mutable state for the test injection hooks in tool-detector and
// claude-plugin-installer. Tests reset / reconfigure this in beforeEach to
// control per-test behaviour without relying on host-installed AI editors
// or a real `claude` CLI. The source modules read these via globalThis.__TEST_MOCKS__.
const detectorState: { tools: DetectedTool[] } = { tools: [] };
const pluginInstallState: { result: PluginInstallResult } = {
  result: {
    status: PluginInstallStatus.Installed,
    pluginsInstalled: [],
    pluginsAlreadyInstalled: [],
    pluginsFailed: [],
  },
};

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
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-stage-"));
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
  // the failure path.
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

function setDetected(tools: DetectedTool[]): void {
  detectorState.tools = tools;
}

function setPluginResult(result: PluginInstallResult): void {
  pluginInstallState.result = result;
}

describe("skills:install command", () => {
  let tempDir: string;
  let originalCwd: string;
  let originalHome: string | undefined;
  let originalPath: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-install-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
    // Hide the host's `claude` CLI so the plugin install path is not exercised.
    originalPath = process.env.PATH;
    process.env.PATH = tempDir;

    fetchMock.mockReset();
    // Wire test injection hooks read by tool-detector / claude-plugin-installer.
    setDetected(ALL_UNDETECTED);
    setPluginResult({
      status: PluginInstallStatus.Installed,
      pluginsInstalled: ["ably-realtime"],
      pluginsAlreadyInstalled: [],
      pluginsFailed: [],
    });
    globalThis.__TEST_MOCKS__ = {
      ...globalThis.__TEST_MOCKS__,
      detectTools: () => Promise.resolve(detectorState.tools),
      installClaudePlugin: () => Promise.resolve(pluginInstallState.result),
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
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (globalThis.__TEST_MOCKS__) {
      delete (globalThis.__TEST_MOCKS__ as Record<string, unknown>).detectTools;
      delete (globalThis.__TEST_MOCKS__ as Record<string, unknown>)
        .installClaudePlugin;
      delete (globalThis.__TEST_MOCKS__ as Record<string, unknown>)
        .verifyAttestation;
    }
    vi.restoreAllMocks();
  });

  standardHelpTests("skills:install", import.meta.url);
  standardArgValidationTests("skills:install", import.meta.url);
  standardFlagTests("skills:install", import.meta.url, ["--target", "--json"]);

  describe("flags", () => {
    it("should list all target options in help", async () => {
      const { stdout } = await runCommand(
        ["skills:install", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("claude-code");
      expect(stdout).toContain("cursor");
      expect(stdout).toContain("auto");
      expect(stdout).toContain("vscode");
      expect(stdout).toContain("windsurf");
    });
  });

  describe("functionality", () => {
    it("should install downloaded skills into the requested target directory", async () => {
      mockFetchWithTarball(
        await buildSkillsTarball("ably-pubsub", "ably-chat"),
      );

      const { error } = await runCommand(
        ["skills:install", "--target", "cursor"],
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
      expect(
        fs.existsSync(
          path.join(tempDir, ".cursor", "skills", "ably-chat", "SKILL.md"),
        ),
      ).toBe(true);
    });

    it("should emit structured JSON describing the install with --json", async () => {
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const { stdout, error } = await runCommand(
        ["skills:install", "--target", "cursor", "--json"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      const firstLine = stdout.trim().split("\n")[0]!;
      const record = JSON.parse(firstLine) as {
        type: string;
        success: boolean;
        installation: {
          skills: Array<{ name: string; description: string }>;
          installed: Array<{ target: string; skillCount: number }>;
          pluginInstalled: boolean;
        };
      };
      expect(record.type).toBe("result");
      expect(record.success).toBe(true);
      expect(record.installation.skills).toEqual([
        { name: "ably-pubsub", description: "Test skill ably-pubsub" },
      ]);
      expect(record.installation.installed).toHaveLength(1);
      expect(record.installation.installed[0]!.target).toBe("cursor");
      expect(record.installation.installed[0]!.skillCount).toBe(1);
      expect(record.installation.pluginInstalled).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should reject --target auto combined with explicit targets", async () => {
      const { error } = await runCommand(
        ["skills:install", "--target", "auto", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /--target auto cannot be combined with explicit targets/i,
      );
    });

    it("should fail loudly when no release is published", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const { error } = await runCommand(
        ["skills:install", "--target", "cursor"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /Failed to resolve latest release|Not Found/i,
      );
    });
  });

  describe("auto-detect", () => {
    it("should warn and skip install when no AI tools are detected", async () => {
      const { stderr, error } = await runCommand(
        ["skills:install"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(stderr).toMatch(/No AI coding tools detected/i);
      // No tarball download should have happened.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should emit JSON envelope with empty installed list when nothing is detected", async () => {
      const { stdout, error } = await runCommand(
        ["skills:install", "--json"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      const resultLine = stdout
        .trim()
        .split("\n")
        .find((line) => {
          try {
            return (JSON.parse(line) as { type?: string }).type === "result";
          } catch {
            return false;
          }
        });
      expect(resultLine).toBeDefined();
      const record = JSON.parse(resultLine!) as {
        installation: {
          installed: unknown[];
          pluginInstalled: boolean;
          detectedTools: { detected: boolean }[];
        };
      };
      expect(record.installation.installed).toEqual([]);
      expect(record.installation.pluginInstalled).toBe(false);
      expect(record.installation.detectedTools.every((t) => !t.detected)).toBe(
        true,
      );
    });

    it("should install to detected file-copy targets without --target", async () => {
      setDetected([
        ...ALL_UNDETECTED.filter((t) => t.id !== "cursor"),
        {
          id: "cursor",
          name: "Cursor",
          detected: true,
          evidence: "config: ~/.cursor",
          installMethod: InstallMethod.FileCopy,
        },
      ]);
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const { error } = await runCommand(["skills:install"], import.meta.url);

      expect(error).toBeUndefined();
      expect(
        fs.existsSync(
          path.join(tempDir, ".cursor", "skills", "ably-pubsub", "SKILL.md"),
        ),
      ).toBe(true);
    });
  });

  describe("Claude Code plugin path", () => {
    it("should install via plugin system when claude CLI is available", async () => {
      setDetected([
        {
          id: "claude-code",
          name: "Claude Code",
          detected: true,
          evidence: "cli: claude",
          installMethod: InstallMethod.Plugin,
        },
        ...ALL_UNDETECTED.filter((t) => t.id !== "claude-code"),
      ]);
      setPluginResult({
        status: PluginInstallStatus.Installed,
        pluginsInstalled: ["ably-realtime"],
        pluginsAlreadyInstalled: [],
        pluginsFailed: [],
      });
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const { stdout, error } = await runCommand(
        ["skills:install", "--target", "claude-code", "--json"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      const record = JSON.parse(
        stdout
          .trim()
          .split("\n")
          .find((line) => {
            try {
              return (JSON.parse(line) as { type?: string }).type === "result";
            } catch {
              return false;
            }
          })!,
      ) as {
        installation: { pluginInstalled: boolean; installed: unknown[] };
      };
      expect(record.installation.pluginInstalled).toBe(true);
      // Should NOT have file-copied skills into ~/.claude when plugin path succeeds.
      expect(record.installation.installed).toEqual([]);
      expect(
        fs.existsSync(
          path.join(tempDir, ".claude", "skills", "ably-pubsub", "SKILL.md"),
        ),
      ).toBe(false);
    });

    it("should fall back to file-copy when plugin install fails", async () => {
      setDetected([
        {
          id: "claude-code",
          name: "Claude Code",
          detected: true,
          evidence: "cli: claude",
          installMethod: InstallMethod.Plugin,
        },
        ...ALL_UNDETECTED.filter((t) => t.id !== "claude-code"),
      ]);
      setPluginResult({
        status: PluginInstallStatus.Error,
        pluginsInstalled: [],
        pluginsAlreadyInstalled: [],
        pluginsFailed: [],
        error: "claude install failed",
      });
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const { stdout, error } = await runCommand(
        ["skills:install", "--target", "claude-code", "--json"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      const record = JSON.parse(
        stdout
          .trim()
          .split("\n")
          .find((line) => {
            try {
              return (JSON.parse(line) as { type?: string }).type === "result";
            } catch {
              return false;
            }
          })!,
      ) as {
        installation: {
          pluginInstalled: boolean;
          installed: { target: string; skillCount: number }[];
        };
      };
      expect(record.installation.pluginInstalled).toBe(false);
      expect(record.installation.installed).toHaveLength(1);
      expect(record.installation.installed[0]!.target).toBe("claude-code");
      // File-copy fallback should write into ~/.claude/skills.
      expect(
        fs.existsSync(
          path.join(tempDir, ".claude", "skills", "ably-pubsub", "SKILL.md"),
        ),
      ).toBe(true);
    });

    it("should treat partial plugin install as success and skip file-copy", async () => {
      setDetected([
        {
          id: "claude-code",
          name: "Claude Code",
          detected: true,
          evidence: "cli: claude",
          installMethod: InstallMethod.Plugin,
        },
        ...ALL_UNDETECTED.filter((t) => t.id !== "claude-code"),
      ]);
      setPluginResult({
        status: PluginInstallStatus.Partial,
        pluginsInstalled: ["ably-realtime"],
        pluginsAlreadyInstalled: [],
        pluginsFailed: [{ name: "ably-chat", error: "plugin chat broke" }],
      });
      mockFetchWithTarball(await buildSkillsTarball("ably-pubsub"));

      const { stdout, stderr, error } = await runCommand(
        ["skills:install", "--target", "claude-code"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      // Warning is emitted on stderr in non-JSON mode.
      const warning = stderr + stdout;
      expect(warning).toMatch(/installed with errors/i);
      expect(warning).toMatch(/ably-chat/);
      // Still considered a success path → no file-copy fallback.
      expect(
        fs.existsSync(
          path.join(tempDir, ".claude", "skills", "ably-pubsub", "SKILL.md"),
        ),
      ).toBe(false);
    });
  });
});
