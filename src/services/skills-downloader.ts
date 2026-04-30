import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { extract } from "tar";

export interface DownloadedSkill {
  name: string;
  directory: string;
}

export class SkillsDownloader {
  private tempDir: string | null = null;

  async download(repo: string): Promise<DownloadedSkill[]> {
    const tarballUrl = `https://github.com/${repo}/archive/refs/heads/main.tar.gz`;
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ably-skills-"));

    const response = await fetch(tarballUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download skills from ${repo}: ${response.statusText}`,
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
        skills.push({ name: entry.name, directory: fullPath });
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
