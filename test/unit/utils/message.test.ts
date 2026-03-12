import { describe, it, expect } from "vitest";
import { prepareMessageFromInput } from "../../../src/utils/message.js";

describe("prepareMessageFromInput", () => {
  it("should handle plain text input", () => {
    const msg = prepareMessageFromInput("hello", {});
    expect(msg.data).toBe("hello");
  });

  it("should handle JSON object with data field", () => {
    const msg = prepareMessageFromInput('{"data":"value"}', {});
    expect(msg.data).toBe("value");
  });

  it("should handle JSON number (primitive)", () => {
    const msg = prepareMessageFromInput("5", {});
    expect(msg.data).toBe(5);
  });

  it("should handle JSON array", () => {
    const msg = prepareMessageFromInput("[1,2,3]", {});
    expect(msg.data).toEqual([1, 2, 3]);
  });

  it("should handle JSON boolean", () => {
    const msg = prepareMessageFromInput("true", {});
    expect(msg.data).toBe(true);
  });

  it("should handle JSON null", () => {
    const msg = prepareMessageFromInput("null", {});
    expect(msg.data).toBeNull();
  });

  it("should extract name from JSON data", () => {
    const msg = prepareMessageFromInput('{"name":"evt","data":"hello"}', {});
    expect(msg.name).toBe("evt");
    expect(msg.data).toBe("hello");
  });

  it("should prefer --name flag over JSON name", () => {
    const msg = prepareMessageFromInput('{"name":"evt","data":"hello"}', {
      name: "override",
    });
    expect(msg.name).toBe("override");
  });

  it("should extract extras from JSON data", () => {
    const msg = prepareMessageFromInput(
      '{"data":"hello","extras":{"push":{"notification":{"title":"T"}}}}',
      {},
    );
    expect(msg.data).toBe("hello");
    expect(msg.extras).toEqual({ push: { notification: { title: "T" } } });
  });

  it("should ignore empty extras", () => {
    const msg = prepareMessageFromInput('{"data":"hello","extras":{}}', {});
    expect(msg.data).toBe("hello");
    expect(msg.extras).toBeUndefined();
  });

  it("should set serial when provided", () => {
    const msg = prepareMessageFromInput(
      '{"data":"hello"}',
      {},
      { serial: "s1" },
    );
    expect(msg.serial).toBe("s1");
  });

  it("should set encoding from flag", () => {
    const msg = prepareMessageFromInput("hello", { encoding: "utf8" });
    expect(msg.encoding).toBe("utf8");
  });

  it("should produce empty data for empty object input", () => {
    const msg = prepareMessageFromInput("{}", {});
    expect(msg.data).toBeUndefined();
  });

  it("should apply interpolation when interpolationIndex is provided", () => {
    const msg = prepareMessageFromInput(
      "Message {{.Count}}",
      {},
      {
        interpolationIndex: 3,
      },
    );
    expect(msg.data).toBe("Message 3");
  });

  it("should not set serial when not provided", () => {
    const msg = prepareMessageFromInput('{"data":"hello"}', {});
    expect(msg.serial).toBeUndefined();
  });
});
