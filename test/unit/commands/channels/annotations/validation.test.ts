import { describe, it, expect } from "vitest";
import {
  extractSummarizationType,
  validateAnnotationParams,
} from "../../../../../src/utils/annotation-validation.js";

describe("annotation validation utilities", () => {
  describe("extractSummarizationType", () => {
    it("should parse valid annotation types", () => {
      expect(extractSummarizationType("reactions:flag.v1")).toBe("flag");
      expect(extractSummarizationType("reactions:distinct.v1")).toBe(
        "distinct",
      );
      expect(extractSummarizationType("emoji:unique.v1")).toBe("unique");
      expect(extractSummarizationType("votes:multiple.v1")).toBe("multiple");
      expect(extractSummarizationType("custom:total.v1")).toBe("total");
    });

    it("should handle namespaces with special characters", () => {
      expect(extractSummarizationType("my-namespace:flag.v1")).toBe("flag");
      expect(extractSummarizationType("ns_test:distinct.v2")).toBe("distinct");
    });

    it("should reject types missing colon separator", () => {
      expect(() => extractSummarizationType("invalidformat")).toThrow(
        "Invalid annotation type format",
      );
    });

    it("should reject types missing dot separator", () => {
      expect(() => extractSummarizationType("reactions:flagv1")).toThrow(
        "Invalid annotation type format",
      );
    });

    it("should reject empty string", () => {
      expect(() => extractSummarizationType("")).toThrow(
        "Invalid annotation type format",
      );
    });
  });

  describe("validateAnnotationParams", () => {
    it("should pass for total.v1 with no extra params", () => {
      const errors = validateAnnotationParams("total", {});
      expect(errors).toHaveLength(0);
    });

    it("should pass for flag.v1 with no extra params", () => {
      const errors = validateAnnotationParams("flag", {});
      expect(errors).toHaveLength(0);
    });

    it("should require name for distinct type", () => {
      const errors = validateAnnotationParams("distinct", {});
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("--name");
      expect(errors[0]).toContain("distinct");
    });

    it("should pass for distinct type with name", () => {
      const errors = validateAnnotationParams("distinct", {
        name: "thumbsup",
      });
      expect(errors).toHaveLength(0);
    });

    it("should require name for unique type", () => {
      const errors = validateAnnotationParams("unique", {});
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("--name");
    });

    it("should require name and count for multiple type", () => {
      const errors = validateAnnotationParams("multiple", {});
      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain("--name");
      expect(errors[1]).toContain("--count");
    });

    it("should pass for multiple type with name and count", () => {
      const errors = validateAnnotationParams("multiple", {
        name: "thumbsup",
        count: 3,
      });
      expect(errors).toHaveLength(0);
    });

    it("should skip count validation for delete operations", () => {
      const errors = validateAnnotationParams("multiple", {
        name: "thumbsup",
        isDelete: true,
      });
      expect(errors).toHaveLength(0);
    });

    it("should still require name for delete on distinct type", () => {
      const errors = validateAnnotationParams("distinct", {
        isDelete: true,
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("--name");
    });

    it("should pass for unknown summarization types (forward compatibility)", () => {
      const errors = validateAnnotationParams("future-type", {});
      expect(errors).toHaveLength(0);
    });
  });
});
