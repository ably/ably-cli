import { describe, expect, it } from "vitest";

import { ENV_VARS_DATA } from "../../../src/data/env-vars.js";
import {
  renderMinimalReference,
  renderSingleVar,
} from "../../../src/utils/env-vars-render.js";

describe("env-vars-render", () => {
  describe("renderMinimalReference", () => {
    it("contains every variable name", () => {
      const out = renderMinimalReference();
      for (const v of ENV_VARS_DATA.variables) expect(out).toContain(v.name);
    });

    it("has a descriptive header about environment variables", () => {
      expect(renderMinimalReference()).toContain("Ably Environment variables");
    });

    it("does not render a Quick Reference section", () => {
      expect(renderMinimalReference()).not.toContain("Quick Reference");
    });

    it("renders each variable with the ably env prefix", () => {
      const out = renderMinimalReference();
      for (const v of ENV_VARS_DATA.variables) {
        expect(out).toContain(`ably env ${v.name}`);
      }
    });

    it("ends with a reference to ably env --help", () => {
      expect(renderMinimalReference()).toContain("ably env --help");
    });

    it("does not render the cross-cutting headings (minimal view drops them)", () => {
      const out = renderMinimalReference();
      expect(out).not.toContain("Authentication Resolution Order");
      expect(out).not.toContain("Running Commands Without Login");
      expect(out).not.toContain("CI/CD Usage");
      expect(out).not.toContain("Commands by Auth Type");
      expect(out).not.toContain("Related");
    });

    it("does not contain dev-only references", () => {
      const out = renderMinimalReference();
      for (const banned of [
        "Development-Usage.md",
        "Debugging.md",
        "Testing.md",
        "Troubleshooting.md",
        "Interactive-REPL.md",
        "Testing note:",
      ]) {
        expect(out).not.toContain(banned);
      }
    });

    it("fits within a reasonable line budget (under 100 lines)", () => {
      const lineCount = renderMinimalReference().split("\n").length;
      expect(lineCount).toBeLessThan(100);
    });
  });

  describe("renderSingleVar", () => {
    it("returns a non-empty string for every variable that contains the name", () => {
      for (const v of ENV_VARS_DATA.variables) {
        const out = renderSingleVar(v.name);
        expect(out.length).toBeGreaterThan(0);
        expect(out).toContain(v.name);
      }
    });

    it("ABLY_TOKEN section mentions 'highest priority'", () => {
      expect(renderSingleVar("ABLY_TOKEN")).toContain("highest priority");
    });

    it("ABLY_API_KEY section contains its format and not other vars' content", () => {
      const out = renderSingleVar("ABLY_API_KEY");
      expect(out).toContain("APP_ID.KEY_ID:KEY_SECRET");
      expect(out).not.toContain("custom-endpoint.example.com");
    });

    it("renders an Example: block with at least one shell prompt for every variable", () => {
      for (const v of ENV_VARS_DATA.variables) {
        const out = renderSingleVar(v.name);
        expect(out).toContain("Example:");
        expect(out).toMatch(/\$ /);
      }
    });

    it("every variable section is at most 20 lines long", () => {
      for (const v of ENV_VARS_DATA.variables) {
        const lineCount = renderSingleVar(v.name).split("\n").length;
        expect(lineCount).toBeLessThanOrEqual(20);
      }
    });

    it("contains at most one https:// URL per variable section", () => {
      for (const v of ENV_VARS_DATA.variables) {
        const out = renderSingleVar(v.name);
        const matches = out.match(/https:\/\//g) ?? [];
        expect(matches.length).toBeLessThanOrEqual(1);
      }
    });

    it("ABLY_API_KEY section surfaces the dashboard URL", () => {
      expect(renderSingleVar("ABLY_API_KEY")).toContain(
        "https://ably.com/accounts/any/apps/any/app_keys",
      );
    });

    it("ABLY_ACCESS_TOKEN section surfaces the access-tokens URL", () => {
      expect(renderSingleVar("ABLY_ACCESS_TOKEN")).toContain(
        "https://ably.com/users/access_tokens",
      );
    });

    it("ABLY_TOKEN section contains the unset-before-issuing footgun callout", () => {
      expect(renderSingleVar("ABLY_TOKEN")).toContain("unset ABLY_TOKEN");
    });

    it("ABLY_HISTORY_FILE section explains the wrapper auto-set behavior", () => {
      expect(renderSingleVar("ABLY_HISTORY_FILE")).toContain(
        "ably-interactive",
      );
    });

    it("does not surface deleted detail-section content (Behavior, Obtaining, etc.)", () => {
      for (const name of [
        "ABLY_API_KEY",
        "ABLY_TOKEN",
        "ABLY_ACCESS_TOKEN",
        "ABLY_APP_ID",
        "ABLY_CLI_CONFIG_DIR",
        "ABLY_CLI_DEFAULT_DURATION",
        "ABLY_CLI_NON_INTERACTIVE",
        "ABLY_ENDPOINT",
      ]) {
        const out = renderSingleVar(name);
        expect(out).not.toContain("Behavior:");
        expect(out).not.toContain("Obtaining ");
        expect(out).not.toContain("Token display");
        expect(out).not.toContain("App name caching");
        expect(out).not.toContain("Crossover usage");
        expect(out).not.toContain("Specifically affects");
        expect(out).not.toContain("28 long-running");
        expect(out).not.toContain("Examples:");
      }
    });

    it("throws for an unknown name", () => {
      expect(() => renderSingleVar("ABLY_NOPE")).toThrow(/No section defined/);
    });
  });
});
