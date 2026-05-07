import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { extract } from "tar";

import {
  ATTESTATION_REPO,
  ATTESTATION_WORKFLOW_PATH,
  verifyTarballAttestation,
} from "./skills-attestation-verifier.js";

export const SKILLS_REPO = ATTESTATION_REPO;

export interface DownloadedSkill {
  name: string;
  directory: string;
  description?: string;
}

export interface SkillsSource {
  repo: string;
  tag: string;
  name: string;
  /** Commit SHA of the released tag — for human auditability. */
  sha: string;
  /** SHA-256 of the verified release tarball, hex-encoded. */
  tarballSha256: string;
  /** Cert SAN URI of the workflow that produced the attestation. */
  attestedBy: string;
}

export interface SkillsDownloadResult {
  skills: DownloadedSkill[];
  source: SkillsSource;
}

interface ReleaseInfo {
  tag_name: string;
  name: string;
}

interface TagRef {
  object: { sha: string; type: string; url: string };
}

interface TagObject {
  object: { sha: string };
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

async function fetchJson<T>(url: string, errorPrefix: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `${errorPrefix}: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as T;
}

async function resolveLatestRelease(
  repo: string,
): Promise<{ tag: string; name: string; sha: string }> {
  const release = await fetchJson<ReleaseInfo>(
    `https://api.github.com/repos/${repo}/releases/latest`,
    `Failed to resolve latest release of ${repo} — please retry`,
  );

  // Resolve the tag ref → commit SHA. Annotated tags need a second hop.
  const tagRef = await fetchJson<TagRef>(
    `https://api.github.com/repos/${repo}/git/refs/tags/${encodeURIComponent(release.tag_name)}`,
    `Failed to resolve tag ${release.tag_name} of ${repo}`,
  );

  let sha = tagRef.object.sha;
  if (tagRef.object.type === "tag") {
    const tagObject = await fetchJson<TagObject>(
      tagRef.object.url,
      `Failed to dereference tag ${release.tag_name} of ${repo}`,
    );
    sha = tagObject.object.sha;
  }

  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    sha,
  };
}

/**
 * Build the release-asset URL produced by `ably/agent-skills`'s release
 * workflow. The asset name format `<repo-name>-<tag>.tar.gz` is fixed in
 * `.github/workflows/release.yml` (ably/agent-skills) — keep these in sync.
 */
function releaseAssetUrl(repo: string, tag: string): string {
  const repoName = repo.split("/")[1]!;
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${repoName}-${tag}.tar.gz`;
}

async function fetchTarballAsBuffer(url: string, tag: string): Promise<Buffer> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to download skills release asset for ${SKILLS_REPO}@${tag}: ${response.status} ${response.statusText}. ` +
        `The release may be missing the attested tarball asset.`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export class SkillsDownloader {
  private tempDir: string | null = null;

  async download(): Promise<SkillsDownloadResult> {
    const release = await resolveLatestRelease(SKILLS_REPO);

    // Always fetch from the release asset URL — that's the file the SLSA
    // attestation is signed against. The auto-generated /archive/refs/tags/
    // tarball is not attested and must be ignored.
    const tarballUrl = releaseAssetUrl(SKILLS_REPO, release.tag);
    const tarball = await fetchTarballAsBuffer(tarballUrl, release.tag);

    // Verify the SLSA build-provenance attestation BEFORE extracting. If
    // verification fails (no bundle, wrong signer, signature mismatch, etc.),
    // we throw and never touch the tarball contents on disk.
    const verification = await verifyTarballAttestation(tarball, {
      repo: SKILLS_REPO,
      workflowPath: ATTESTATION_WORKFLOW_PATH,
    });

    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ably-skills-"));

    await pipeline(
      Readable.from(tarball),
      createGunzip(),
      extract({ cwd: this.tempDir, strip: 1 }),
    );

    const source: SkillsSource = {
      repo: SKILLS_REPO,
      tag: release.tag,
      name: release.name,
      sha: release.sha,
      tarballSha256: verification.tarballSha256,
      attestedBy: verification.signerIdentity,
    };

    const skills = this.findSkills(this.tempDir, source);
    return { skills, source };
  }

  private findSkills(baseDir: string, source: SkillsSource): DownloadedSkill[] {
    const skillsDir = path.join(baseDir, "skills");
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        throw new Error(
          `Skills directory missing in ${source.repo}@${source.tag}`,
          { cause: error },
        );
      }
      throw error;
    }

    const skills: DownloadedSkill[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(skillsDir, entry.name);
      const skillFile = path.join(fullPath, "SKILL.md");
      let content: string;
      try {
        content = fs.readFileSync(skillFile, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      const { description } = parseSkillFrontmatter(content);
      skills.push({ name: entry.name, directory: fullPath, description });
    }

    return skills;
  }

  cleanup(): void {
    if (this.tempDir) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
      this.tempDir = null;
    }
  }
}
