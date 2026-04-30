import { describe, expect, it } from "vitest";

import {
  CrossCuttingSection,
  DetailSection,
  ENV_VARS_DATA,
  EnvVarEntry,
  EnvVarsData,
  Example,
  RelatedLink,
} from "../../../src/data/env-vars.js";

const CANONICAL_NAMES = [
  "ABLY_API_KEY",
  "ABLY_TOKEN",
  "ABLY_ACCESS_TOKEN",
  "ABLY_ENDPOINT",
  "ABLY_APP_ID",
  "ABLY_CLI_CONFIG_DIR",
  "ABLY_HISTORY_FILE",
  "ABLY_CLI_DEFAULT_DURATION",
  "ABLY_CLI_NON_INTERACTIVE",
];

describe("ENV_VARS_DATA", () => {
  it("is an EnvVarsData instance", () => {
    expect(ENV_VARS_DATA).toBeInstanceOf(EnvVarsData);
  });

  it("lists exactly 9 variables in canonical order", () => {
    expect(ENV_VARS_DATA.variables).toHaveLength(9);
    expect(ENV_VARS_DATA.variables.map((v) => v.name)).toEqual(CANONICAL_NAMES);
  });

  it("every variable is a properly typed EnvVarEntry instance", () => {
    for (const v of ENV_VARS_DATA.variables) {
      expect(v).toBeInstanceOf(EnvVarEntry);
      expect(v.example).toBeInstanceOf(Example);
      for (const d of v.details) expect(d).toBeInstanceOf(DetailSection);
    }
  });

  it("variable names are unique and match the ABLY_* shape", () => {
    const names = ENV_VARS_DATA.variables.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^ABLY_[A-Z_]+$/);
  });

  it("every variable has all required fields populated", () => {
    for (const v of ENV_VARS_DATA.variables) {
      expect(v.category.length).toBeGreaterThan(0);
      expect(v.purpose.length).toBeGreaterThan(0);
      expect(v.format.length).toBeGreaterThan(0);
      expect(v.default_.length).toBeGreaterThan(0);
      expect(v.intro.length).toBeGreaterThan(0);
      expect(v.details.length).toBeGreaterThan(0);
    }
  });

  it("every variable has a description and at least one example shell line (minimal-view contract)", () => {
    for (const v of ENV_VARS_DATA.variables) {
      expect(v.example.description.length).toBeGreaterThan(0);
      expect(v.example.lines.length).toBeGreaterThanOrEqual(1);
      for (const line of v.example.lines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  it("cross-cutting sections are CrossCuttingSection instances with the expected headings", () => {
    const cc = ENV_VARS_DATA.crossCutting;
    expect(cc.authResolutionOrder).toBeInstanceOf(CrossCuttingSection);
    expect(cc.oneShotUsage).toBeInstanceOf(CrossCuttingSection);
    expect(cc.cicdUsage).toBeInstanceOf(CrossCuttingSection);
    expect(cc.commandsByAuthType).toBeInstanceOf(CrossCuttingSection);
    expect(cc.authResolutionOrder.heading).toBe(
      "Authentication Resolution Order",
    );
    expect(cc.oneShotUsage.heading).toBe(
      "Running Commands Without Login (One-Shot Usage)",
    );
    expect(cc.cicdUsage.heading).toBe("CI/CD Usage");
    expect(cc.commandsByAuthType.heading).toBe("Commands by Auth Type");
  });

  it("relatedLinks contains 8 external links (internal doc cross-links stripped)", () => {
    expect(ENV_VARS_DATA.relatedLinks).toHaveLength(8);
    for (const link of ENV_VARS_DATA.relatedLinks) {
      expect(link).toBeInstanceOf(RelatedLink);
      expect(link.url).toMatch(/^https:\/\/ably\.com\//);
      expect(link.text.length).toBeGreaterThan(0);
      expect(link.blurb.length).toBeGreaterThan(0);
    }
  });

  it("does not contain any dev-only doc references", () => {
    const serialized = JSON.stringify(ENV_VARS_DATA);
    for (const banned of [
      "Development-Usage.md",
      "Debugging.md",
      "Testing.md",
      "Troubleshooting.md",
      "Interactive-REPL.md",
      "Testing note:",
    ]) {
      expect(serialized).not.toContain(banned);
    }
  });
});
