import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runCommand } from "../../helpers/command-helpers.js";
import {
  cleanupTrackedResources,
  resetTestTracking,
  setupTestFailureHandler,
} from "../../helpers/e2e-test-helper.js";

// Skills install hits GitHub to fetch the agent-skills tarball + extracts it.
// Give it generous headroom over the default 20s e2e timeout.
const SKILLS_TIMEOUT_MS = 60000;

interface JsonRecord {
  type: string;
  command: string;
  success?: boolean;
  status?: string;
  exitCode?: number;
  installation?: {
    skills: Array<{ name: string; description?: string }>;
    installed: Array<{
      target: string;
      skillCount: number;
      skills: Array<{ skillName: string; status: string }>;
    }>;
    pluginInstalled: boolean;
  };
}

function parseNdjson(stdout: string): JsonRecord[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonRecord);
}

describe("Skills install E2E", () => {
  let tempHome: string;

  beforeEach(() => {
    resetTestTracking();
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "ably-skills-e2e-"));
  });

  afterEach(async () => {
    await cleanupTrackedResources();
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it(
    "downloads the published bundle and installs skills into the cursor target",
    async () => {
      setupTestFailureHandler(
        "downloads the published bundle and installs skills into the cursor target",
      );

      const result = await runCommand(
        ["skills", "install", "--target", "cursor", "--json"],
        {
          env: { HOME: tempHome, NODE_OPTIONS: "--no-inspect" },
          timeoutMs: SKILLS_TIMEOUT_MS,
        },
      );

      expect(result.exitCode).toBe(0);

      const records = parseNdjson(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");
      const completedRecord = records.find(
        (r) => r.type === "status" && r.status === "completed",
      );

      expect(resultRecord, "missing result envelope").toBeDefined();
      expect(resultRecord!.success).toBe(true);
      expect(resultRecord!.installation).toBeDefined();
      expect(resultRecord!.installation!.skills.length).toBeGreaterThan(0);

      const cursorEntry = resultRecord!.installation!.installed.find(
        (r) => r.target === "cursor",
      );
      expect(cursorEntry, "cursor target not in installed list").toBeDefined();
      expect(cursorEntry!.skillCount).toBeGreaterThan(0);
      expect(cursorEntry!.skills.every((s) => s.status === "installed")).toBe(
        true,
      );

      expect(completedRecord, "missing completed status line").toBeDefined();
      expect(completedRecord!.exitCode).toBe(0);

      const skillsDir = path.join(tempHome, ".cursor", "skills");
      expect(fs.existsSync(skillsDir)).toBe(true);

      const onDisk = fs
        .readdirSync(skillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
      const expectedSkills = cursorEntry!.skills.map((s) => s.skillName);
      expect(onDisk.toSorted()).toEqual([...expectedSkills].toSorted());

      // Every installed skill should expose a SKILL.md — confirms tar extraction
      // wrote real content, not just empty directories.
      for (const name of onDisk) {
        expect(fs.existsSync(path.join(skillsDir, name, "SKILL.md"))).toBe(
          true,
        );
      }
    },
    SKILLS_TIMEOUT_MS + 5000,
  );
});
