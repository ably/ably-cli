import { describe, it, expect } from "vitest";
import {
  extractSummarizationType,
  validateAnnotationParams,
} from "../../../src/utils/annotations.js";

describe("extractSummarizationType", () => {
  describe("valid annotation types", () => {
    it("should extract 'flag' from 'reactions:flag.v1'", () => {
      expect(extractSummarizationType("reactions:flag.v1")).toBe("flag");
    });

    it("should extract 'distinct' from 'reactions:distinct.v1'", () => {
      expect(extractSummarizationType("reactions:distinct.v1")).toBe(
        "distinct",
      );
    });

    it("should extract 'unique' from 'emoji:unique.v1'", () => {
      expect(extractSummarizationType("emoji:unique.v1")).toBe("unique");
    });

    it("should extract 'multiple' from 'votes:multiple.v1'", () => {
      expect(extractSummarizationType("votes:multiple.v1")).toBe("multiple");
    });

    it("should extract 'total' from 'views:total.v1'", () => {
      expect(extractSummarizationType("views:total.v1")).toBe("total");
    });

    it("should handle namespaces with special characters", () => {
      expect(extractSummarizationType("my-namespace:flag.v1")).toBe("flag");
    });

    it("should handle version numbers other than v1", () => {
      expect(extractSummarizationType("reactions:distinct.v2")).toBe(
        "distinct",
      );
    });
  });

  describe("invalid annotation types", () => {
    it("should throw on missing colon", () => {
      expect(() => extractSummarizationType("reactionsflag.v1")).toThrow(
        'Invalid annotation type format. Expected "namespace:summarization.version"',
      );
    });

    it("should throw on missing dot", () => {
      expect(() => extractSummarizationType("reactions:flagv1")).toThrow(
        'Invalid annotation type format. Expected "namespace:summarization.version"',
      );
    });

    it("should throw on empty string", () => {
      expect(() => extractSummarizationType("")).toThrow(
        'Invalid annotation type format. Expected "namespace:summarization.version"',
      );
    });

    it("should throw on colon only", () => {
      expect(() => extractSummarizationType(":")).toThrow(
        'Invalid annotation type format. Expected "namespace:summarization.version"',
      );
    });

    it("should throw on namespace:only (no dot)", () => {
      expect(() => extractSummarizationType("reactions:flag")).toThrow(
        'Invalid annotation type format. Expected "namespace:summarization.version"',
      );
    });
  });
});

describe("validateAnnotationParams", () => {
  describe("total.v1 type", () => {
    it("should pass with no extra params", () => {
      expect(validateAnnotationParams("total", {})).toEqual([]);
    });

    it("should pass with optional name", () => {
      expect(validateAnnotationParams("total", { name: "test" })).toEqual([]);
    });
  });

  describe("flag.v1 type", () => {
    it("should pass with no extra params", () => {
      expect(validateAnnotationParams("flag", {})).toEqual([]);
    });

    it("should pass with optional name", () => {
      expect(validateAnnotationParams("flag", { name: "test" })).toEqual([]);
    });
  });

  describe("distinct.v1 type", () => {
    it("should require name", () => {
      const errors = validateAnnotationParams("distinct", {});
      expect(errors).toContain(
        '--name is required for "distinct" annotation types',
      );
    });

    it("should pass with name provided", () => {
      expect(
        validateAnnotationParams("distinct", { name: "thumbsup" }),
      ).toEqual([]);
    });
  });

  describe("unique.v1 type", () => {
    it("should require name", () => {
      const errors = validateAnnotationParams("unique", {});
      expect(errors).toContain(
        '--name is required for "unique" annotation types',
      );
    });

    it("should pass with name provided", () => {
      expect(validateAnnotationParams("unique", { name: "option1" })).toEqual(
        [],
      );
    });
  });

  describe("multiple.v1 type", () => {
    it("should require both name and count for publish", () => {
      const errors = validateAnnotationParams("multiple", {});
      expect(errors).toContain(
        '--name is required for "multiple" annotation types',
      );
      expect(errors).toContain(
        '--count is required for "multiple" annotation types',
      );
    });

    it("should require name even with count", () => {
      const errors = validateAnnotationParams("multiple", { count: 5 });
      expect(errors).toContain(
        '--name is required for "multiple" annotation types',
      );
    });

    it("should require count even with name", () => {
      const errors = validateAnnotationParams("multiple", { name: "votes" });
      expect(errors).toContain(
        '--count is required for "multiple" annotation types',
      );
    });

    it("should pass with both name and count", () => {
      expect(
        validateAnnotationParams("multiple", { name: "votes", count: 3 }),
      ).toEqual([]);
    });

    it("should accept count of 0", () => {
      expect(
        validateAnnotationParams("multiple", { name: "votes", count: 0 }),
      ).toEqual([]);
    });
  });

  describe("delete operations", () => {
    it("should not require count for multiple type on delete", () => {
      const errors = validateAnnotationParams("multiple", {
        name: "votes",
        isDelete: true,
      });
      expect(errors).toEqual([]);
    });

    it("should still require name for multiple type on delete", () => {
      const errors = validateAnnotationParams("multiple", { isDelete: true });
      expect(errors).toContain(
        '--name is required for "multiple" annotation types',
      );
    });

    it("should still require name for distinct type on delete", () => {
      const errors = validateAnnotationParams("distinct", { isDelete: true });
      expect(errors).toContain(
        '--name is required for "distinct" annotation types',
      );
    });
  });

  describe("unknown summarization types (forward compatibility)", () => {
    it("should pass for unknown types with no params", () => {
      expect(validateAnnotationParams("future", {})).toEqual([]);
    });

    it("should pass for unknown types with any params", () => {
      expect(
        validateAnnotationParams("future", { name: "test", count: 5 }),
      ).toEqual([]);
    });
  });
});
