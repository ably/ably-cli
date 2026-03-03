import { describe, it, expect } from "vitest";
import { getCliVersion } from "../../../src/utils/version.js";
import packageJson from "../../../package.json" with { type: "json" };

describe("version utility", function () {
  describe("getCliVersion", function () {
    it("should return a valid semantic version string", function () {
      const version = getCliVersion();
      expect(version).toBeTypeOf("string");
      // Should match semantic versioning format (e.g., 1.2.3, 1.2.3-beta.1, etc.)
      expect(version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
    });

    it("should return the same version from package.json", function () {
      const version = getCliVersion();
      expect(version).toBe(packageJson.version);
    });

    it("should return consistent version on multiple calls", function () {
      const version1 = getCliVersion();
      const version2 = getCliVersion();
      const version3 = getCliVersion();

      expect(version1).toBe(version2);
      expect(version2).toBe(version3);
    });

    it("should return a non-empty version", function () {
      const version = getCliVersion();
      expect(version.length).toBeGreaterThan(0);
    });
  });
});
