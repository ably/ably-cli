import * as crypto from "node:crypto";
import type { Bundle } from "sigstore";

import isTestMode from "../utils/test-mode.js";

/**
 * Repo whose attestations we'll fetch and trust. Locked to the canonical
 * agent-skills repo so a fork can't pretend to be us.
 */
export const ATTESTATION_REPO = "ably/agent-skills";

/**
 * Workflow file path that must have produced the attestation. The cert SAN
 * URI ends in `<repo>/<workflowPath>@<git-ref>`, so locking this prevents an
 * attestation from any *other* workflow file in the same repo from being
 * accepted (e.g. a malicious workflow added in a PR).
 */
export const ATTESTATION_WORKFLOW_PATH = ".github/workflows/release.yml";

/** OIDC issuer GitHub Actions uses to sign Sigstore identity certificates. */
const GITHUB_ACTIONS_OIDC_ISSUER =
  "https://token.actions.githubusercontent.com";

const escapeRegex = (s: string) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface AttestationsResponse {
  attestations?: Array<{
    bundle: Bundle;
    repository_id?: number;
  }>;
}

export interface AttestationVerificationOptions {
  repo: string;
  workflowPath: string;
}

export interface AttestationVerificationResult {
  /** SHA-256 of the verified tarball, hex-encoded. */
  tarballSha256: string;
  /** Cert SAN identity that signed the attestation (the workflow URI). */
  signerIdentity: string;
}

/**
 * Verify a tarball against GitHub's published SLSA build-provenance attestation.
 *
 * Steps:
 *   1. SHA-256 the tarball.
 *   2. Pull the attestation bundle from `repos/<repo>/attestations/sha256:<digest>`.
 *   3. Verify cryptographically via sigstore (Sigstore Public Good trust root).
 *   4. Enforce a SAN-URI policy that locks the signer to `<repo>/<workflowPath>`
 *      on either a release tag (`refs/tags/v*`) or `refs/heads/main`
 *      (workflow_dispatch path).
 *
 * Throws on any verification failure — there is no fallback.
 */
export async function verifyTarballAttestation(
  tarball: Buffer,
  opts: AttestationVerificationOptions,
): Promise<AttestationVerificationResult> {
  const tarballSha256 = crypto
    .createHash("sha256")
    .update(tarball)
    .digest("hex");

  // Test hook: oclif's command loader can sidestep vitest's module-mocking,
  // so we expose a per-test override that returns a canned result. Real
  // verification (network + cryptographic checks against Sigstore Public
  // Good) only runs in production. Tests set __TEST_MOCKS__.verifyAttestation
  // to either a result or a function that throws, to exercise both branches.
  if (isTestMode() && globalThis.__TEST_MOCKS__?.verifyAttestation) {
    const hook = globalThis.__TEST_MOCKS__ as {
      verifyAttestation: (
        sha256: string,
        opts: AttestationVerificationOptions,
      ) =>
        | Promise<AttestationVerificationResult>
        | AttestationVerificationResult;
    };
    return hook.verifyAttestation(tarballSha256, opts);
  }

  const url = `https://api.github.com/repos/${opts.repo}/attestations/sha256:${tarballSha256}`;
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch attestation for ${opts.repo}@${tarballSha256.slice(0, 12)}: ${response.status} ${response.statusText}. ` +
        `The release tarball is not attested by ${opts.repo} — refusing to install.`,
    );
  }

  const data = (await response.json()) as AttestationsResponse;
  if (!data.attestations || data.attestations.length === 0) {
    throw new Error(
      `No attestations found for ${opts.repo}@${tarballSha256.slice(0, 12)} — refusing to install.`,
    );
  }

  // sigstore-js's SAN check uses String.prototype.match(), which interprets
  // the policy string as a regex. We anchor with ^...$ so we require a full
  // match, escape regex metacharacters in the inputs, and require the workflow
  // ref to be a release tag (`refs/tags/v*`). Branches (including main) are
  // rejected: an attacker with write access to main could otherwise click
  // "Run workflow" from main and produce a valid attestation.
  // workflow_dispatch re-runs must select the tag in "Use workflow from" —
  // not main — for the attestation to verify.
  const sanPolicy = `^https://github\\.com/${escapeRegex(opts.repo)}/${escapeRegex(opts.workflowPath)}@refs/tags/v[0-9].*$`;

  const { verify } = await import("sigstore");

  let lastError: Error | undefined;
  for (const att of data.attestations) {
    try {
      const signer = await verify(att.bundle, tarball, {
        certificateIssuer: GITHUB_ACTIONS_OIDC_ISSUER,
        certificateIdentityURI: sanPolicy,
      });
      const signerIdentity =
        signer.identity?.subjectAlternativeName ?? "<unknown>";
      return { tarballSha256, signerIdentity };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(
    `Attestation verification failed for ${opts.repo}@${tarballSha256.slice(0, 12)}: ${lastError?.message ?? "unknown error"}`,
  );
}
