import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { create as tarCreate } from "tar";

// `sigstore.verify` does cryptographic + transparency-log checks against the
// real Sigstore Public Good infrastructure. We stub it so unit tests can
// exercise the downloader's verification *plumbing* (fetching the bundle,
// invoking the verifier, surfacing the result) without leaving the host.
const verifyMock = vi.fn();
vi.mock("sigstore", async () => ({
  verify: (...args: unknown[]) => verifyMock(...args),
}));

const { SKILLS_REPO, SkillsDownloader } =
  await import("../../../src/services/skills-downloader.js");

const TEST_RELEASE = {
  tag: "v0.1.0",
  name: "v0.1.0",
  sha: "abc123def456789012345678901234567890abcd",
};

interface BuildOpts {
  /** Direct children of skills/ — each gets a SKILL.md. */
  skills?: string[];
  /** Top-level (non-skills/) entries with a SKILL.md — should be ignored. */
  nonSkillTopLevel?: string[];
  /** Nested directories under skills/<name>/<sub>/ with their own SKILL.md — should be ignored. */
  nestedUnderSkill?: { parent: string; sub: string }[];
  /** Skip creating the skills/ directory entirely (to test the missing-dir error). */
  omitSkillsDir?: boolean;
}

async function buildTarball(opts: BuildOpts): Promise<Buffer> {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-dl-test-"));
  const repoDir = path.join(stagingDir, "agent-skills-v0.1.0");
  fs.mkdirSync(repoDir, { recursive: true });

  if (!opts.omitSkillsDir) {
    const skillsRoot = path.join(repoDir, "skills");
    fs.mkdirSync(skillsRoot, { recursive: true });
    for (const name of opts.skills ?? []) {
      const skillDir = path.join(skillsRoot, name);
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\n`,
      );
    }
    for (const { parent, sub } of opts.nestedUnderSkill ?? []) {
      const parentDir = path.join(skillsRoot, parent);
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(
        path.join(parentDir, "SKILL.md"),
        `---\nname: ${parent}\ndescription: parent skill\n---\n`,
      );
      const nestedDir = path.join(parentDir, sub);
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(
        path.join(nestedDir, "SKILL.md"),
        `---\nname: ${sub}\ndescription: nested fake skill\n---\n`,
      );
    }
  }

  for (const name of opts.nonSkillTopLevel ?? []) {
    const dir = path.join(repoDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: should be ignored\n---\n`,
    );
  }

  const stream = tarCreate({ gzip: true, cwd: stagingDir }, [
    "agent-skills-v0.1.0",
  ]);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  fs.rmSync(stagingDir, { recursive: true, force: true });
  return Buffer.concat(chunks);
}

interface FetchOpts {
  /** Override the release-resolution status (default 200). */
  releaseStatus?: number;
  /** Override the asset-fetch status (default 200). */
  assetStatus?: number;
  /** Override the attestation-fetch status (default 200). */
  attestationStatus?: number;
  /** Force the attestations API to return zero attestations. */
  noAttestations?: boolean;
}

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function wireFetch(buffer: Buffer | null, opts: FetchOpts = {}): void {
  fetchMock.mockImplementation(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/releases/latest")) {
      if ((opts.releaseStatus ?? 200) !== 200) {
        return {
          ok: false,
          status: opts.releaseStatus,
          statusText: "Not Found",
        } as unknown as Response;
      }
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          tag_name: TEST_RELEASE.tag,
          name: TEST_RELEASE.name,
        }),
      } as unknown as Response;
    }
    if (url.includes("/git/refs/tags/")) {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          object: { sha: TEST_RELEASE.sha, type: "commit", url: "" },
        }),
      } as unknown as Response;
    }
    if (url.includes("/attestations/sha256:")) {
      if ((opts.attestationStatus ?? 200) !== 200) {
        return {
          ok: false,
          status: opts.attestationStatus,
          statusText: "Not Found",
        } as unknown as Response;
      }
      return {
        ok: true,
        statusText: "OK",
        json: async () =>
          opts.noAttestations
            ? { attestations: [] }
            : { attestations: [{ bundle: { mediaType: "fake-bundle" } }] },
      } as unknown as Response;
    }
    if (url.includes("/releases/download/")) {
      if ((opts.assetStatus ?? 200) !== 200) {
        return {
          ok: false,
          status: opts.assetStatus,
          statusText: "Not Found",
        } as unknown as Response;
      }
      if (buffer === null) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as unknown as Response;
      }
      return {
        ok: true,
        statusText: "OK",
        arrayBuffer: async () =>
          buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ),
      } as unknown as Response;
    }
    return {
      ok: false,
      status: 404,
      statusText: `Unexpected URL: ${url}`,
    } as unknown as Response;
  });
}

describe("SkillsDownloader", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    verifyMock.mockReset();
    // Default: attestation verification succeeds with a believable signer.
    verifyMock.mockResolvedValue({
      identity: {
        subjectAlternativeName: `https://github.com/${SKILLS_REPO}/.github/workflows/release.yml@refs/tags/${TEST_RELEASE.tag}`,
      },
    });
    globalThis.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("constants", () => {
    it("should target the official agent-skills repo", () => {
      expect(SKILLS_REPO).toBe("ably/agent-skills");
    });
  });

  describe("download (release pinning + attestation)", () => {
    it("should fetch the release asset, verify attestation, and surface source metadata", async () => {
      wireFetch(await buildTarball({ skills: ["ably-pubsub", "ably-chat"] }));
      const downloader = new SkillsDownloader();
      try {
        const result = await downloader.download();
        expect(result.source.repo).toBe("ably/agent-skills");
        expect(result.source.tag).toBe(TEST_RELEASE.tag);
        expect(result.source.sha).toBe(TEST_RELEASE.sha);
        expect(result.source.tarballSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(result.source.attestedBy).toContain(
          ".github/workflows/release.yml",
        );
        expect(result.skills.map((s) => s.name).toSorted()).toEqual([
          "ably-chat",
          "ably-pubsub",
        ]);
        const assetCall = fetchMock.mock.calls.find((c) =>
          String(c[0]).includes("/releases/download/"),
        );
        expect(assetCall).toBeDefined();
        expect(String(assetCall![0])).toContain("agent-skills-v0.1.0.tar.gz");
        expect(verifyMock).toHaveBeenCalledTimes(1);
      } finally {
        downloader.cleanup();
      }
    });

    it("should fail loudly when no release is published", async () => {
      wireFetch(null, { releaseStatus: 404 });
      const downloader = new SkillsDownloader();
      try {
        await expect(downloader.download()).rejects.toThrow(
          /Failed to resolve latest release/i,
        );
      } finally {
        downloader.cleanup();
      }
    });

    it("should fail loudly when the release asset is missing", async () => {
      wireFetch(null, { assetStatus: 404 });
      const downloader = new SkillsDownloader();
      try {
        await expect(downloader.download()).rejects.toThrow(
          /Failed to download skills release asset/i,
        );
      } finally {
        downloader.cleanup();
      }
    });

    it("should fail loudly when no attestation exists for the tarball", async () => {
      wireFetch(await buildTarball({ skills: ["ably-pubsub"] }), {
        attestationStatus: 404,
      });
      const downloader = new SkillsDownloader();
      try {
        await expect(downloader.download()).rejects.toThrow(
          /Failed to fetch attestation/i,
        );
      } finally {
        downloader.cleanup();
      }
    });

    it("should fail loudly when the attestations list is empty", async () => {
      wireFetch(await buildTarball({ skills: ["ably-pubsub"] }), {
        noAttestations: true,
      });
      const downloader = new SkillsDownloader();
      try {
        await expect(downloader.download()).rejects.toThrow(
          /No attestations found/i,
        );
      } finally {
        downloader.cleanup();
      }
    });

    it("should fail loudly when sigstore.verify rejects", async () => {
      wireFetch(await buildTarball({ skills: ["ably-pubsub"] }));
      verifyMock.mockRejectedValue(new Error("certificate identity error"));
      const downloader = new SkillsDownloader();
      try {
        await expect(downloader.download()).rejects.toThrow(
          /Attestation verification failed.*certificate identity error/i,
        );
      } finally {
        downloader.cleanup();
      }
    });
  });

  describe("findSkills (skills/ scoping)", () => {
    it("should ignore top-level non-skills/ directories that contain SKILL.md", async () => {
      wireFetch(
        await buildTarball({
          skills: ["ably-pubsub"],
          nonSkillTopLevel: ["test", ".github"],
        }),
      );
      const downloader = new SkillsDownloader();
      try {
        const result = await downloader.download();
        expect(result.skills.map((s) => s.name)).toEqual(["ably-pubsub"]);
      } finally {
        downloader.cleanup();
      }
    });

    it("should not recurse into subdirectories of a skill", async () => {
      wireFetch(
        await buildTarball({
          skills: ["ably-pubsub"],
          nestedUnderSkill: [{ parent: "ably-chat", sub: "references" }],
        }),
      );
      const downloader = new SkillsDownloader();
      try {
        const result = await downloader.download();
        expect(result.skills.map((s) => s.name).toSorted()).toEqual([
          "ably-chat",
          "ably-pubsub",
        ]);
      } finally {
        downloader.cleanup();
      }
    });

    it("should throw when the tarball has no skills/ directory", async () => {
      wireFetch(await buildTarball({ omitSkillsDir: true }));
      const downloader = new SkillsDownloader();
      try {
        await expect(downloader.download()).rejects.toThrow(
          /Skills directory missing/i,
        );
      } finally {
        downloader.cleanup();
      }
    });
  });

  describe("cleanup", () => {
    it("should not throw when called before any download", () => {
      const downloader = new SkillsDownloader();
      expect(() => downloader.cleanup()).not.toThrow();
      expect(() => downloader.cleanup()).not.toThrow();
    });
  });
});
