import { describe, it, expect } from "vitest";
import { chunkText } from "../../../src/utils/text-chunker.js";

describe("chunkText", () => {
  describe("functionality", () => {
    it("should split text into chunks of approximately the given size", () => {
      const text = "The quick brown fox jumps over the lazy dog";
      const chunks = chunkText(text, 10);

      expect(chunks.length).toBeGreaterThan(1);
      // All chunks together should equal original text
      expect(chunks.join("")).toBe(text);
    });

    it("should prefer word boundaries", () => {
      const text = "Hello world this is a test";
      const chunks = chunkText(text, 6);

      // Should break at space near chunk size
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join("")).toBe(text);
      // First chunk should break at a word boundary
      expect(chunks[0]).toMatch(/\s$/);
    });

    it("should handle text shorter than chunk size", () => {
      const text = "Hi";
      const chunks = chunkText(text, 10);

      expect(chunks).toEqual(["Hi"]);
    });

    it("should handle empty string", () => {
      const chunks = chunkText("", 5);

      expect(chunks).toEqual([]);
    });

    it("should handle single-word text", () => {
      const text = "Supercalifragilisticexpialidocious";
      const chunks = chunkText(text, 10);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join("")).toBe(text);
    });

    it("should handle exact chunk size text", () => {
      const text = "12345";
      const chunks = chunkText(text, 5);

      expect(chunks).toEqual(["12345"]);
    });

    it("should preserve spaces within chunks", () => {
      const text = "Hello world, how are you today?";
      const chunks = chunkText(text, 8);

      // Verify all content including spaces is preserved
      expect(chunks.join("")).toBe(text);

      // At least some chunks should contain spaces
      const chunksWithSpaces = chunks.filter((c) => c.includes(" "));
      expect(chunksWithSpaces.length).toBeGreaterThan(0);
    });

    it("should produce chunks close to the target size", () => {
      const text = "The quick brown fox jumps over the lazy dog and runs away";
      const chunks = chunkText(text, 8);

      for (const chunk of chunks) {
        // Chunks should be within reasonable range of target (8 ± 4)
        expect(chunk.length).toBeLessThanOrEqual(12);
      }
      expect(chunks.join("")).toBe(text);
    });

    it("should return the full text as a single chunk when chunkSize is 0", () => {
      const text = "Hello world";
      const chunks = chunkText(text, 0);

      expect(chunks).toEqual(["Hello world"]);
    });

    it("should return the full text as a single chunk when chunkSize is negative", () => {
      const text = "Hello world";
      const chunks = chunkText(text, -5);

      expect(chunks).toEqual(["Hello world"]);
    });

    it("should handle chunkSize of 1", () => {
      const text = "Hello";
      const chunks = chunkText(text, 1);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join("")).toBe(text);
    });

    it("should handle very large chunkSize relative to text", () => {
      const text = "Short";
      const chunks = chunkText(text, 10000);

      expect(chunks).toEqual(["Short"]);
    });
  });
});
