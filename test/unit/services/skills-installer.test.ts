import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SkillsInstaller } from "../../../src/services/skills-installer.js";
import { DownloadedSkill } from "../../../src/services/skills-downloader.js";

describe("SkillsInstaller", () => {
  let tempSrcDir: string;
  let tempDestDir: string;
  let skills: DownloadedSkill[];
  const logMessages: string[] = [];

  function mockLog(message: string) {
    logMessages.push(message);
  }

  beforeEach(() => {
    logMessages.length = 0;

    // Create source skill directories
    tempSrcDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-src-"));
    tempDestDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-dest-"));

    const skill1Dir = path.join(tempSrcDir, "ably-pubsub");
    const skill2Dir = path.join(tempSrcDir, "ably-chat");

    fs.mkdirSync(skill1Dir, { recursive: true });
    fs.writeFileSync(path.join(skill1Dir, "SKILL.md"), "# Pub/Sub Skill");
    fs.mkdirSync(path.join(skill1Dir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skill1Dir, "references", "api.md"),
      "API reference content",
    );

    fs.mkdirSync(skill2Dir, { recursive: true });
    fs.writeFileSync(path.join(skill2Dir, "SKILL.md"), "# Chat Skill");

    skills = [
      { name: "ably-pubsub", directory: skill1Dir },
      { name: "ably-chat", directory: skill2Dir },
    ];
  });

  afterEach(() => {
    if (fs.existsSync(tempSrcDir)) {
      fs.rmSync(tempSrcDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tempDestDir)) {
      fs.rmSync(tempDestDir, { recursive: true, force: true });
    }
  });

  describe("resolveTargets", () => {
    it('should expand "all" to all target keys', () => {
      const targets = SkillsInstaller.resolveTargets(["all"]);
      expect(targets).toContain("claude-code");
      expect(targets).toContain("cursor");
      expect(targets).toContain("agents");
      expect(targets).toHaveLength(3);
    });

    it("should pass through specific targets", () => {
      const targets = SkillsInstaller.resolveTargets(["claude-code"]);
      expect(targets).toEqual(["claude-code"]);
    });

    it("should pass through multiple targets", () => {
      const targets = SkillsInstaller.resolveTargets(["claude-code", "cursor"]);
      expect(targets).toEqual(["claude-code", "cursor"]);
    });
  });

  describe("install", () => {
    it("should install skills to the specified target directory", async () => {
      // We override the target config by using global with a known home
      // Instead, we test the behavior through the actual project-level install
      const installer = new SkillsInstaller();

      // For testing, we'll use the project-level install which uses relative paths
      // We need to change cwd to tempDestDir for this to work
      const originalCwd = process.cwd();
      process.chdir(tempDestDir);

      try {
        const results = await installer.install({
          skills,
          global: false,
          targets: ["claude-code"],
          force: false,
          log: mockLog,
        });

        expect(results).toHaveLength(1);
        expect(results[0].target).toBe("claude-code");
        expect(results[0].skillCount).toBe(2);

        // Verify files were copied
        const skillDir = path.join(
          tempDestDir,
          ".claude",
          "skills",
          "ably-pubsub",
        );
        expect(fs.existsSync(skillDir)).toBe(true);
        expect(fs.existsSync(path.join(skillDir, "SKILL.md"))).toBe(true);
        expect(fs.existsSync(path.join(skillDir, "references", "api.md"))).toBe(
          true,
        );

        const chatDir = path.join(
          tempDestDir,
          ".claude",
          "skills",
          "ably-chat",
        );
        expect(fs.existsSync(chatDir)).toBe(true);
        expect(fs.existsSync(path.join(chatDir, "SKILL.md"))).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("should install to multiple targets", async () => {
      const installer = new SkillsInstaller();
      const originalCwd = process.cwd();
      process.chdir(tempDestDir);

      try {
        const results = await installer.install({
          skills,
          global: false,
          targets: ["claude-code", "cursor", "agents"],
          force: false,
          log: mockLog,
        });

        expect(results).toHaveLength(3);

        expect(
          fs.existsSync(
            path.join(
              tempDestDir,
              ".claude",
              "skills",
              "ably-pubsub",
              "SKILL.md",
            ),
          ),
        ).toBe(true);
        expect(
          fs.existsSync(
            path.join(
              tempDestDir,
              ".cursor",
              "skills",
              "ably-pubsub",
              "SKILL.md",
            ),
          ),
        ).toBe(true);
        expect(
          fs.existsSync(
            path.join(
              tempDestDir,
              ".agents",
              "skills",
              "ably-pubsub",
              "SKILL.md",
            ),
          ),
        ).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("should skip existing skills without --force", async () => {
      const installer = new SkillsInstaller();
      const originalCwd = process.cwd();
      process.chdir(tempDestDir);

      try {
        // Pre-create a skill directory
        const existingDir = path.join(
          tempDestDir,
          ".claude",
          "skills",
          "ably-pubsub",
        );
        fs.mkdirSync(existingDir, { recursive: true });
        fs.writeFileSync(path.join(existingDir, "SKILL.md"), "# Old content");

        const results = await installer.install({
          skills,
          global: false,
          targets: ["claude-code"],
          force: false,
          log: mockLog,
        });

        expect(results[0].skills[0].status).toBe("skipped");
        expect(results[0].skills[1].status).toBe("installed");
        expect(results[0].skillCount).toBe(1);

        // Verify old content is preserved
        const content = fs.readFileSync(
          path.join(existingDir, "SKILL.md"),
          "utf8",
        );
        expect(content).toBe("# Old content");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("should overwrite existing skills with --force", async () => {
      const installer = new SkillsInstaller();
      const originalCwd = process.cwd();
      process.chdir(tempDestDir);

      try {
        // Pre-create a skill directory
        const existingDir = path.join(
          tempDestDir,
          ".claude",
          "skills",
          "ably-pubsub",
        );
        fs.mkdirSync(existingDir, { recursive: true });
        fs.writeFileSync(path.join(existingDir, "SKILL.md"), "# Old content");

        const results = await installer.install({
          skills,
          global: false,
          targets: ["claude-code"],
          force: true,
          log: mockLog,
        });

        expect(results[0].skills[0].status).toBe("updated");
        expect(results[0].skillCount).toBe(2);

        // Verify new content
        const content = fs.readFileSync(
          path.join(existingDir, "SKILL.md"),
          "utf8",
        );
        expect(content).toBe("# Pub/Sub Skill");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("should filter skills when skillFilter is provided", async () => {
      const installer = new SkillsInstaller();
      const originalCwd = process.cwd();
      process.chdir(tempDestDir);

      try {
        const results = await installer.install({
          skills,
          global: false,
          targets: ["claude-code"],
          force: false,
          skillFilter: ["ably-chat"],
          log: mockLog,
        });

        expect(results[0].skillCount).toBe(1);
        expect(results[0].skills).toHaveLength(1);
        expect(results[0].skills[0].skillName).toBe("ably-chat");

        expect(
          fs.existsSync(
            path.join(tempDestDir, ".claude", "skills", "ably-pubsub"),
          ),
        ).toBe(false);
        expect(
          fs.existsSync(
            path.join(
              tempDestDir,
              ".claude",
              "skills",
              "ably-chat",
              "SKILL.md",
            ),
          ),
        ).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("should throw when skillFilter matches no skills", async () => {
      const installer = new SkillsInstaller();

      await expect(
        installer.install({
          skills,
          global: false,
          targets: ["claude-code"],
          force: false,
          skillFilter: ["nonexistent-skill"],
          log: mockLog,
        }),
      ).rejects.toThrow(/No matching skills found/);
    });

    it("should ignore unknown target keys", async () => {
      const installer = new SkillsInstaller();
      const originalCwd = process.cwd();
      process.chdir(tempDestDir);

      try {
        const results = await installer.install({
          skills,
          global: false,
          targets: ["unknown-target"],
          force: false,
          log: mockLog,
        });

        expect(results).toHaveLength(0);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("should copy all skill contents recursively", async () => {
      // Add nested directories to source skills
      const scriptsDir = path.join(tempSrcDir, "ably-pubsub", "scripts");
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(
        path.join(scriptsDir, "setup.sh"),
        "#!/bin/bash\necho hello",
      );

      const installer = new SkillsInstaller();
      const originalCwd = process.cwd();
      process.chdir(tempDestDir);

      try {
        await installer.install({
          skills,
          global: false,
          targets: ["claude-code"],
          force: false,
          log: mockLog,
        });

        const destScriptsDir = path.join(
          tempDestDir,
          ".claude",
          "skills",
          "ably-pubsub",
          "scripts",
        );
        expect(fs.existsSync(destScriptsDir)).toBe(true);
        expect(fs.existsSync(path.join(destScriptsDir, "setup.sh"))).toBe(true);

        const content = fs.readFileSync(
          path.join(destScriptsDir, "setup.sh"),
          "utf8",
        );
        expect(content).toBe("#!/bin/bash\necho hello");
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
