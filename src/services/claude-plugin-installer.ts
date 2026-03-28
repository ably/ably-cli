import { execFile } from "node:child_process";

export type PluginInstallStatus = "installed" | "already-installed" | "error";

export interface PluginInstallResult {
  status: PluginInstallStatus;
  pluginsInstalled?: string[];
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

async function fetchMarketplaceManifest(
  repo: string,
): Promise<MarketplaceManifest> {
  const url = `https://raw.githubusercontent.com/${repo}/main/.claude-plugin/marketplace.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch marketplace manifest from ${repo}: ${response.statusText}`,
    );
  }
  return (await response.json()) as MarketplaceManifest;
}

export async function installClaudePlugin(
  repo: string,
): Promise<PluginInstallResult> {
  try {
    // Step 1: Fetch marketplace manifest to discover plugin names
    const manifest = await fetchMarketplaceManifest(repo);
    const marketplaceName = manifest.name;
    const pluginNames = manifest.plugins.map((p) => p.name);

    if (pluginNames.length === 0) {
      return { status: "error", error: "No plugins found in marketplace" };
    }

    // Step 2: Add marketplace
    await runClaude(["plugin", "marketplace", "add", repo]);

    // Step 3: Install each plugin
    const installed: string[] = [];
    for (const pluginName of pluginNames) {
      await runClaude([
        "plugin",
        "install",
        `${pluginName}@${marketplaceName}`,
      ]);
      installed.push(pluginName);
    }

    return { status: "installed", pluginsInstalled: installed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("already") || message.includes("exists")) {
      return { status: "already-installed" };
    }

    return { status: "error", error: message };
  }
}
