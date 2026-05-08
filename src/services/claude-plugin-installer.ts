import { execFile } from "node:child_process";

import isTestMode from "../utils/test-mode.js";
import { SKILLS_REPO } from "./skills-downloader.js";

export enum PluginInstallStatus {
  Installed = "installed",
  AlreadyInstalled = "already-installed",
  Partial = "partial",
  Error = "error",
}

export interface PluginInstallFailure {
  name: string;
  error: string;
}

export interface PluginInstallResult {
  status: PluginInstallStatus;
  pluginsInstalled: string[];
  pluginsAlreadyInstalled: string[];
  pluginsFailed: PluginInstallFailure[];
  /** Top-level error (e.g. manifest fetch failed). Only set when status is "error". */
  error?: string;
}

interface MarketplaceManifest {
  name: string;
  plugins: { name: string }[];
}

function runClaude(
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile("claude", args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function isAlreadyInstalledMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already installed") ||
    lower.includes("already exists") ||
    lower.includes("already added")
  );
}

async function fetchMarketplaceManifest(
  repo: string,
  ref: string,
): Promise<MarketplaceManifest> {
  const url = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref)}/.claude-plugin/marketplace.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch marketplace manifest from ${repo}@${ref}: ${response.statusText}`,
    );
  }
  return (await response.json()) as MarketplaceManifest;
}

export async function installClaudePlugin(
  ref: string,
): Promise<PluginInstallResult> {
  if (isTestMode() && globalThis.__TEST_MOCKS__?.installClaudePlugin) {
    return (
      globalThis.__TEST_MOCKS__ as {
        installClaudePlugin: (ref: string) => Promise<PluginInstallResult>;
      }
    ).installClaudePlugin(ref);
  }
  let manifest: MarketplaceManifest;
  try {
    manifest = await fetchMarketplaceManifest(SKILLS_REPO, ref);
  } catch (error) {
    return {
      status: PluginInstallStatus.Error,
      pluginsInstalled: [],
      pluginsAlreadyInstalled: [],
      pluginsFailed: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const marketplaceName = manifest.name;
  const pluginNames = manifest.plugins.map((p) => p.name);

  if (pluginNames.length === 0) {
    return {
      status: PluginInstallStatus.Error,
      pluginsInstalled: [],
      pluginsAlreadyInstalled: [],
      pluginsFailed: [],
      error: "No plugins found in marketplace",
    };
  }

  try {
    await runClaude(["plugin", "marketplace", "add", SKILLS_REPO]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isAlreadyInstalledMessage(message)) {
      return {
        status: PluginInstallStatus.Error,
        pluginsInstalled: [],
        pluginsAlreadyInstalled: [],
        pluginsFailed: [],
        error: message,
      };
    }
  }

  const pluginsInstalled: string[] = [];
  const pluginsAlreadyInstalled: string[] = [];
  const pluginsFailed: PluginInstallFailure[] = [];

  for (const pluginName of pluginNames) {
    try {
      await runClaude([
        "plugin",
        "install",
        `${pluginName}@${marketplaceName}`,
      ]);
      pluginsInstalled.push(pluginName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isAlreadyInstalledMessage(message)) {
        pluginsAlreadyInstalled.push(pluginName);
      } else {
        pluginsFailed.push({ name: pluginName, error: message });
      }
    }
  }

  let status: PluginInstallStatus;
  if (pluginsFailed.length === pluginNames.length) {
    status = PluginInstallStatus.Error;
  } else if (pluginsFailed.length > 0) {
    status = PluginInstallStatus.Partial;
  } else if (pluginsInstalled.length === 0) {
    status = PluginInstallStatus.AlreadyInstalled;
  } else {
    status = PluginInstallStatus.Installed;
  }

  return {
    status,
    pluginsInstalled,
    pluginsAlreadyInstalled,
    pluginsFailed,
  };
}
