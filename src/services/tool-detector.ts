import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import isTestMode from "../utils/test-mode.js";

export interface DetectedTool {
  id: string;
  name: string;
  detected: boolean;
  /** First piece of evidence found (e.g. "cli: claude", "config: ~/.cursor"). Empty when not detected. */
  evidence: string;
  installMethod: "plugin" | "file-copy";
}

interface ToolCheck {
  id: string;
  name: string;
  installMethod: "plugin" | "file-copy";
  cliNames?: string[];
  macApps?: string[];
  linuxPaths?: string[];
  winPaths?: string[];
  configDirs?: string[];
}

const home = os.homedir();
const localAppData =
  process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
const programFiles = process.env.ProgramFiles || "C:\\Program Files";

const TOOL_CHECKS: ToolCheck[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    installMethod: "plugin",
    cliNames: ["claude"],
    configDirs: [path.join(home, ".claude")],
  },
  {
    id: "cursor",
    name: "Cursor",
    installMethod: "file-copy",
    cliNames: ["cursor"],
    macApps: ["/Applications/Cursor.app"],
    linuxPaths: [
      "/usr/share/cursor",
      "/opt/Cursor",
      path.join(home, ".local", "share", "cursor"),
    ],
    winPaths: [
      path.join(localAppData, "Programs", "Cursor", "Cursor.exe"),
      path.join(localAppData, "cursor"),
    ],
    configDirs: [path.join(home, ".cursor")],
  },
  {
    id: "vscode",
    name: "VS Code",
    installMethod: "file-copy",
    cliNames: ["code"],
    macApps: ["/Applications/Visual Studio Code.app"],
    linuxPaths: ["/usr/share/code", "/snap/code/current", "/usr/bin/code"],
    winPaths: [
      path.join(programFiles, "Microsoft VS Code", "Code.exe"),
      path.join(localAppData, "Programs", "Microsoft VS Code", "Code.exe"),
    ],
    configDirs: [path.join(home, ".vscode")],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    installMethod: "file-copy",
    cliNames: ["windsurf"],
    macApps: ["/Applications/Windsurf.app"],
    linuxPaths: ["/opt/Windsurf"],
    winPaths: [path.join(localAppData, "Programs", "Windsurf", "Windsurf.exe")],
    configDirs: [path.join(home, ".windsurf")],
  },
];

function checkCli(name: string): Promise<string | null> {
  const cmd = process.platform === "win32" ? "where" : "which";
  return new Promise((resolve) => {
    execFile(cmd, [name], { timeout: 2000 }, (error, stdout) => {
      if (error) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function checkPath(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

async function detectToolFromCheck(check: ToolCheck): Promise<DetectedTool> {
  // CLI binaries
  if (check.cliNames) {
    const results = await Promise.all(
      check.cliNames.map((name) => checkCli(name)),
    );
    const hit = results.findIndex(Boolean);
    if (hit !== -1) {
      return makeDetected(check, `cli: ${check.cliNames[hit]}`);
    }
  }

  // Platform-specific app paths
  const appPaths =
    process.platform === "darwin"
      ? check.macApps
      : process.platform === "linux"
        ? check.linuxPaths
        : process.platform === "win32"
          ? check.winPaths
          : undefined;
  if (appPaths) {
    const hit = appPaths.find((p) => checkPath(p));
    if (hit) return makeDetected(check, `app: ${path.basename(hit)}`);
  }

  // Config directories
  if (check.configDirs) {
    const hit = check.configDirs.find((d) => checkPath(d));
    if (hit) return makeDetected(check, `config: ${hit.replace(home, "~")}`);
  }

  return {
    id: check.id,
    name: check.name,
    detected: false,
    evidence: "",
    installMethod: check.installMethod,
  };
}

function makeDetected(check: ToolCheck, evidence: string): DetectedTool {
  return {
    id: check.id,
    name: check.name,
    detected: true,
    evidence,
    installMethod: check.installMethod,
  };
}

export async function detectTools(): Promise<DetectedTool[]> {
  if (isTestMode() && globalThis.__TEST_MOCKS__?.detectTools) {
    return (
      globalThis.__TEST_MOCKS__ as {
        detectTools: () => Promise<DetectedTool[]>;
      }
    ).detectTools();
  }
  return Promise.all(TOOL_CHECKS.map((check) => detectToolFromCheck(check)));
}

/**
 * Focused probe for a single tool's CLI binary. Used when an explicit
 * `--target` is given and we only need to learn whether one specific tool's
 * CLI is on PATH (e.g. claude), without paying for a full multi-tool scan.
 */
export async function detectTool(toolId: string): Promise<DetectedTool | null> {
  if (isTestMode() && globalThis.__TEST_MOCKS__?.detectTools) {
    const tools = await (
      globalThis.__TEST_MOCKS__ as {
        detectTools: () => Promise<DetectedTool[]>;
      }
    ).detectTools();
    return tools.find((t) => t.id === toolId) ?? null;
  }
  const check = TOOL_CHECKS.find((c) => c.id === toolId);
  if (!check) return null;
  return detectToolFromCheck(check);
}
