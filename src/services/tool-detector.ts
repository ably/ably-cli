import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface DetectedTool {
  id: string;
  name: string;
  detected: boolean;
  evidence: string[];
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
  {
    id: "zed",
    name: "Zed",
    installMethod: "file-copy",
    cliNames: ["zed"],
    macApps: ["/Applications/Zed.app"],
    linuxPaths: ["/usr/bin/zed", path.join(home, ".local", "bin", "zed")],
    configDirs: [path.join(home, ".config", "zed")],
  },
  {
    id: "continue",
    name: "Continue.dev",
    installMethod: "file-copy",
    configDirs: [path.join(home, ".continue")],
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

async function detectTool(check: ToolCheck): Promise<DetectedTool> {
  const evidence: string[] = [];

  // Check CLI binaries
  if (check.cliNames) {
    const cliResults = await Promise.all(
      check.cliNames.map((name) => checkCli(name)),
    );
    for (let i = 0; i < check.cliNames.length; i++) {
      if (cliResults[i]) {
        evidence.push(`cli: ${check.cliNames[i]}`);
      }
    }
  }

  // Check platform-specific app paths
  const platform = process.platform;
  const appPaths =
    platform === "darwin"
      ? check.macApps
      : platform === "linux"
        ? check.linuxPaths
        : platform === "win32"
          ? check.winPaths
          : undefined;

  if (appPaths) {
    for (const appPath of appPaths) {
      if (checkPath(appPath)) {
        evidence.push(`app: ${path.basename(appPath)}`);
        break; // one match is enough
      }
    }
  }

  // Check config directories
  if (check.configDirs) {
    for (const configDir of check.configDirs) {
      if (checkPath(configDir)) {
        evidence.push(`config: ${configDir.replace(home, "~")}`);
      }
    }
  }

  return {
    id: check.id,
    name: check.name,
    detected: evidence.length > 0,
    evidence,
    installMethod: check.installMethod,
  };
}

export async function detectTools(): Promise<DetectedTool[]> {
  return Promise.all(TOOL_CHECKS.map((check) => detectTool(check)));
}

export function getToolChecks(): ToolCheck[] {
  return TOOL_CHECKS;
}
