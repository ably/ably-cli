import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
    },
  };
});

// Import after mocking
const { detectTools, getToolChecks } =
  await import("../../../src/services/tool-detector.js");

describe("tool-detector", () => {
  const mockedExecFile = vi.mocked(execFile);
  const mockedExistsSync = vi.mocked(fs.existsSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should define checks for all expected tools", () => {
    const checks = getToolChecks();
    const ids = checks.map((c) => c.id);
    expect(ids).toContain("claude-code");
    expect(ids).toContain("cursor");
    expect(ids).toContain("vscode");
    expect(ids).toContain("windsurf");
    expect(ids).toContain("zed");
    expect(ids).toContain("continue");
  });

  it("should return all tools as not detected when nothing is found", async () => {
    mockedExecFile.mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: Error | null, stdout: string) => void)(
          new Error("not found"),
          "",
        );
        return undefined as never;
      },
    );

    const results = await detectTools();

    expect(results.length).toBeGreaterThanOrEqual(6);
    for (const tool of results) {
      expect(tool.detected).toBe(false);
      expect(tool.evidence).toHaveLength(0);
    }
  });

  it("should detect a tool via CLI binary", async () => {
    mockedExecFile.mockImplementation(
      (_cmd: unknown, args: unknown, _opts: unknown, cb: unknown) => {
        const argList = args as string[];
        if (argList[0] === "claude") {
          (cb as (err: Error | null, stdout: string) => void)(
            null,
            "/usr/local/bin/claude",
          );
        } else {
          (cb as (err: Error | null, stdout: string) => void)(
            new Error("not found"),
            "",
          );
        }
        return undefined as never;
      },
    );

    const results = await detectTools();
    const claudeCode = results.find((t) => t.id === "claude-code");

    expect(claudeCode).toBeDefined();
    expect(claudeCode!.detected).toBe(true);
    expect(claudeCode!.evidence).toContain("cli: claude");
    expect(claudeCode!.installMethod).toBe("plugin");
  });

  it("should detect a tool via config directory", async () => {
    mockedExecFile.mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: Error | null, stdout: string) => void)(
          new Error("not found"),
          "",
        );
        return undefined as never;
      },
    );

    mockedExistsSync.mockImplementation((p: fs.PathLike) => {
      const pathStr = String(p);
      return pathStr.includes(".continue");
    });

    const results = await detectTools();
    const continuedev = results.find((t) => t.id === "continue");

    expect(continuedev).toBeDefined();
    expect(continuedev!.detected).toBe(true);
    expect(continuedev!.evidence.some((e) => e.startsWith("config:"))).toBe(
      true,
    );
    expect(continuedev!.installMethod).toBe("file-copy");
  });

  it("should detect multiple tools simultaneously", async () => {
    mockedExecFile.mockImplementation(
      (_cmd: unknown, args: unknown, _opts: unknown, cb: unknown) => {
        const argList = args as string[];
        if (argList[0] === "claude" || argList[0] === "cursor") {
          (cb as (err: Error | null, stdout: string) => void)(
            null,
            `/usr/local/bin/${argList[0]}`,
          );
        } else {
          (cb as (err: Error | null, stdout: string) => void)(
            new Error("not found"),
            "",
          );
        }
        return undefined as never;
      },
    );

    const results = await detectTools();
    const detected = results.filter((t) => t.detected);

    expect(detected.length).toBeGreaterThanOrEqual(2);
    expect(detected.some((t) => t.id === "claude-code")).toBe(true);
    expect(detected.some((t) => t.id === "cursor")).toBe(true);
  });

  it("should set correct install methods", () => {
    const checks = getToolChecks();

    const claudeCheck = checks.find((c) => c.id === "claude-code");
    expect(claudeCheck!.installMethod).toBe("plugin");

    const cursorCheck = checks.find((c) => c.id === "cursor");
    expect(cursorCheck!.installMethod).toBe("file-copy");
  });
});
