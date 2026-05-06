import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execFile } from "node:child_process";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockManifest = {
  name: "ably-agent-skills",
  plugins: [{ name: "ably-realtime" }, { name: "ably-chat" }],
};

const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

const { installClaudePlugin } =
  await import("../../../src/services/claude-plugin-installer.js");

describe("claude-plugin-installer", () => {
  const mockedExecFile = vi.mocked(execFile);

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockManifest),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch manifest and install all plugins on success", async () => {
    mockedExecFile.mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          null,
          "OK",
          "",
        );
        return undefined as never;
      },
    );

    const result = await installClaudePlugin();

    expect(result.status).toBe("installed");
    expect(result.pluginsInstalled).toEqual(["ably-realtime", "ably-chat"]);
    expect(result.error).toBeUndefined();
  });

  it("should return already-installed when every plugin install reports already exists", async () => {
    mockedExecFile.mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          new Error("already exists"),
          "",
          "already exists",
        );
        return undefined as never;
      },
    );

    const result = await installClaudePlugin();

    expect(result.status).toBe("already-installed");
    expect(result.pluginsAlreadyInstalled).toEqual([
      "ably-realtime",
      "ably-chat",
    ]);
    expect(result.pluginsInstalled).toEqual([]);
    expect(result.pluginsFailed).toEqual([]);
  });

  it("should return error when every plugin install fails", async () => {
    mockedExecFile.mockImplementation(
      (_cmd: unknown, args: unknown, _opts: unknown, cb: unknown) => {
        const argList = args as string[];
        // Allow marketplace add to succeed; fail per-plugin installs.
        if (argList[0] === "plugin" && argList[1] === "marketplace") {
          (cb as (err: Error | null, stdout: string, stderr: string) => void)(
            null,
            "OK",
            "",
          );
        } else {
          (cb as (err: Error | null, stdout: string, stderr: string) => void)(
            new Error("command failed"),
            "",
            "command failed",
          );
        }
        return undefined as never;
      },
    );

    const result = await installClaudePlugin();

    expect(result.status).toBe("error");
    expect(result.pluginsFailed).toHaveLength(2);
    expect(result.pluginsInstalled).toEqual([]);
  });

  it("should return partial when some plugins fail and others succeed", async () => {
    mockedExecFile.mockImplementation(
      (_cmd: unknown, args: unknown, _opts: unknown, cb: unknown) => {
        const argList = args as string[];
        const last = argList.at(-1) ?? "";
        if (typeof last === "string" && last.startsWith("ably-chat")) {
          (cb as (err: Error | null, stdout: string, stderr: string) => void)(
            new Error("network error"),
            "",
            "network error",
          );
        } else {
          (cb as (err: Error | null, stdout: string, stderr: string) => void)(
            null,
            "OK",
            "",
          );
        }
        return undefined as never;
      },
    );

    const result = await installClaudePlugin();

    expect(result.status).toBe("partial");
    expect(result.pluginsInstalled).toEqual(["ably-realtime"]);
    expect(result.pluginsFailed).toEqual([
      { name: "ably-chat", error: "network error" },
    ]);
  });

  it("should continue past existing plugins and install the rest", async () => {
    mockedExecFile.mockImplementation(
      (_cmd: unknown, args: unknown, _opts: unknown, cb: unknown) => {
        const argList = args as string[];
        const last = argList.at(-1) ?? "";
        if (typeof last === "string" && last.startsWith("ably-realtime")) {
          (cb as (err: Error | null, stdout: string, stderr: string) => void)(
            new Error("already installed"),
            "",
            "already installed",
          );
        } else {
          (cb as (err: Error | null, stdout: string, stderr: string) => void)(
            null,
            "OK",
            "",
          );
        }
        return undefined as never;
      },
    );

    const result = await installClaudePlugin();

    expect(result.status).toBe("installed");
    expect(result.pluginsInstalled).toEqual(["ably-chat"]);
    expect(result.pluginsAlreadyInstalled).toEqual(["ably-realtime"]);
    expect(result.pluginsFailed).toEqual([]);
  });

  it("should return error when manifest fetch fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    const result = await installClaudePlugin();

    expect(result.status).toBe("error");
    expect(result.error).toContain("Failed to fetch marketplace manifest");
  });

  it("should call claude with correct arguments derived from manifest", async () => {
    const calls: string[][] = [];
    mockedExecFile.mockImplementation(
      (_cmd: unknown, args: unknown, _opts: unknown, cb: unknown) => {
        calls.push(args as string[]);
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          null,
          "OK",
          "",
        );
        return undefined as never;
      },
    );

    await installClaudePlugin();

    // 1 marketplace add + 2 plugin installs
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual([
      "plugin",
      "marketplace",
      "add",
      "ably/agent-skills",
    ]);
    expect(calls[1]).toEqual([
      "plugin",
      "install",
      "ably-realtime@ably-agent-skills",
    ]);
    expect(calls[2]).toEqual([
      "plugin",
      "install",
      "ably-chat@ably-agent-skills",
    ]);
  });

  it("should return error when manifest has no plugins", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "empty", plugins: [] }),
    });

    const result = await installClaudePlugin();

    expect(result.status).toBe("error");
    expect(result.error).toContain("No plugins found");
  });
});
