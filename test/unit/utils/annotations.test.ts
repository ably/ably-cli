import { describe, it, expect } from "vitest";
import {
  extractSummarizationType,
  validateAnnotationParams,
} from "../../../src/utils/annotations.js";

describe("annotations utility", () => {
  describe("extractSummarizationType", () => {
    it('should extract "flag" from "reactions:flag.v1"', () => {
      expect(extractSummarizationType("reactions:flag.v1")).toBe("flag");
    });

    it('should extract "distinct" from "reactions:distinct.v1"', () => {
      expect(extractSummarizationType("reactions:distinct.v1")).toBe(
        "distinct",
      );
    });

    it('should extract "unique" from "reactions:unique.v1"', () => {
      expect(extractSummarizationType("reactions:unique.v1")).toBe("unique");
    });

    it('should extract "multiple" from "reactions:multiple.v1"', () => {
      expect(extractSummarizationType("reactions:multiple.v1")).toBe(
        "multiple",
      );
    });

    it('should extract "total" from "custom:total.v2"', () => {
      expect(extractSummarizationType("custom:total.v2")).toBe("total");
    });

    it("should handle custom namespaces", () => {
      expect(extractSummarizationType("my-namespace:flag.v1")).toBe("flag");
    });

    it("should throw on missing colon", () => {
      expect(() => extractSummarizationType("invalidformat")).toThrow(
        "Invalid annotation type format",
      );
    });

    it("should throw on missing dot", () => {
      expect(() => extractSummarizationType("reactions:nodot")).toThrow(
        "Invalid annotation type format",
      );
    });

    it("should throw on empty string", () => {
      expect(() => extractSummarizationType("")).toThrow(
        "Invalid annotation type format",
      );
    });
  });

  describe("validateAnnotationParams", () => {
    it("should return no errors for total type", () => {
      expect(validateAnnotationParams("total", {})).toEqual([]);
    });

    it("should return no errors for flag type", () => {
      expect(validateAnnotationParams("flag", {})).toEqual([]);
    });

    it("should require --name for distinct type", () => {
      const errors = validateAnnotationParams("distinct", {});
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("--name is required");
      expect(errors[0]).toContain("distinct");
    });

    it("should pass for distinct type with name", () => {
      expect(
        validateAnnotationParams("distinct", { name: "thumbsup" }),
      ).toEqual([]);
    });

    it("should require --name for unique type", () => {
      const errors = validateAnnotationParams("unique", {});
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("--name is required");
      expect(errors[0]).toContain("unique");
    });

    it("should pass for unique type with name", () => {
      expect(validateAnnotationParams("unique", { name: "thumbsup" })).toEqual(
        [],
      );
    });

    it("should require --name for multiple type", () => {
      const errors = validateAnnotationParams("multiple", {});
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("--name is required");
      expect(errors[0]).toContain("multiple");
    });

    it("should pass for multiple type with name only (count defaults to 1)", () => {
      expect(
        validateAnnotationParams("multiple", { name: "thumbsup" }),
      ).toEqual([]);
    });

    it("should pass for unknown future types (forward compatibility)", () => {
      expect(validateAnnotationParams("unknown-future-type", {})).toEqual([]);
    });
  });
});
