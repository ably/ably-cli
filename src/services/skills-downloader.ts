import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { extract } from "tar";

export const SKILLS_REPO = "ably/agent-skills";

export interface DownloadedSkill {
  name: string;
  directory: string;
  description?: string;
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
}

function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const block = match[1]!;
  const result: SkillFrontmatter = {};

  const nameMatch = block.match(/^name:[ \t]*(.+)$/m);
  if (nameMatch) result.name = nameMatch[1]!.trim();

  // YAML folded scalar: `description: >` (or `|`) followed by indented lines
  const foldedMatch = block.match(
    /^description:[ \t]*[>|][-+]?[ \t]*\r?\n((?:[ \t]+.*(?:\r?\n|$))+)/m,
  );
  if (foldedMatch) {
    const lines = foldedMatch[1]!
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    result.description = lines.join(" ");
  } else {
    const inlineMatch = block.match(/^description:[ \t]*(.+)$/m);
    if (inlineMatch) result.description = inlineMatch[1]!.trim();
  }

  return result;
}

export class SkillsDownloader {
  private tempDir: string | null = null;

  async download(): Promise<DownloadedSkill[]> {
    const tarballUrl = `https://github.com/${SKILLS_REPO}/archive/refs/heads/main.tar.gz`;
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ably-skills-"));

    const response = await fetch(tarballUrl, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to download skills from ${SKILLS_REPO}: ${response.statusText}`,
      );
    }

    if (!response.body) {
      throw new Error("Empty response body from GitHub");
    }

    await pipeline(
      Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      ),
      createGunzip(),
      extract({ cwd: this.tempDir, strip: 1 }),
    );

    return this.findSkills(this.tempDir);
  }

  private findSkills(baseDir: string): DownloadedSkill[] {
    const skills: DownloadedSkill[] = [];
    this.walkForSkills(baseDir, skills);
    return skills;
  }

  private walkForSkills(dir: string, skills: DownloadedSkill[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(dir, entry.name);
      const skillFile = path.join(fullPath, "SKILL.md");

      if (fs.existsSync(skillFile)) {
        const content = fs.readFileSync(skillFile, "utf8");
        const { description } = parseSkillFrontmatter(content);
        skills.push({ name: entry.name, directory: fullPath, description });
      } else {
        this.walkForSkills(fullPath, skills);
      }
    }
  }

  cleanup(): void {
    if (this.tempDir) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
      this.tempDir = null;
    }
  }
}
