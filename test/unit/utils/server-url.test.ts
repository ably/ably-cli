import { describe, it, expect } from "vitest";
import {
  formatServerUrl,
  parseServerUrl,
} from "../../../src/utils/server-url.js";

describe("parseServerUrl", () => {
  it("decomposes a plaintext local URL", () => {
    expect(parseServerUrl("http://localhost:8081")).toEqual({
      host: "localhost",
      path: "",
      port: 8081,
      tls: false,
    });
  });

  it("decomposes an https URL", () => {
    expect(parseServerUrl("https://server.example.com:8443")).toEqual({
      host: "server.example.com",
      path: "",
      port: 8443,
      tls: true,
    });
  });

  it("leaves port undefined when the URL relies on the scheme default", () => {
    expect(parseServerUrl("https://server.example.com").port).toBeUndefined();
  });

  it("leaves port undefined when the port matches the scheme default", () => {
    // URL parsing drops a redundant default port; the SDK supplies the same
    // value, so the result is identical.
    expect(
      parseServerUrl("https://server.example.com:443").port,
    ).toBeUndefined();
  });

  it("defaults schemeless loopback input to http", () => {
    expect(parseServerUrl("localhost:8081")).toEqual({
      host: "localhost",
      path: "",
      port: 8081,
      tls: false,
    });
  });

  it("defaults schemeless 127.0.0.1 input to http", () => {
    expect(parseServerUrl("127.0.0.1:8081").tls).toBe(false);
  });

  it("defaults schemeless non-loopback input to https", () => {
    expect(parseServerUrl("server.example.com:8081")).toEqual({
      host: "server.example.com",
      path: "",
      port: 8081,
      tls: true,
    });
  });

  it("honours an explicit http scheme on a non-loopback host", () => {
    expect(parseServerUrl("http://server.example.com").tls).toBe(false);
  });

  it("preserves an IPv6 host in bracketed form", () => {
    // The SDK treats any endpoint containing "::" as a literal host, so the
    // brackets must survive parsing.
    expect(parseServerUrl("http://[::1]:8081").host).toBe("[::1]");
  });

  it("returns a normalised path when one is present", () => {
    expect(parseServerUrl("http://localhost:8082/api/v1").path).toBe("/api/v1");
  });

  it("strips a trailing slash from the path", () => {
    expect(parseServerUrl("http://localhost:8082/api/").path).toBe("/api");
  });

  it("reports an empty path for a bare origin", () => {
    expect(parseServerUrl("http://localhost:8082/").path).toBe("");
  });

  it("throws on empty input", () => {
    expect(() => parseServerUrl("   ")).toThrow("URL cannot be empty");
  });

  it("throws on an unsupported scheme", () => {
    expect(() => parseServerUrl("ws://localhost:8081")).toThrow(
      /Unsupported scheme "ws"/,
    );
  });

  it("throws on unparseable input", () => {
    expect(() => parseServerUrl("http://")).toThrow(/Invalid URL/);
  });
});

describe("formatServerUrl", () => {
  it("renders a plaintext URL with a port", () => {
    expect(
      formatServerUrl({ host: "localhost", path: "", port: 8081, tls: false }),
    ).toBe("http://localhost:8081");
  });

  it("renders an https URL without a port", () => {
    expect(formatServerUrl({ host: "example.com", path: "", tls: true })).toBe(
      "https://example.com",
    );
  });

  it("includes the path when present", () => {
    expect(
      formatServerUrl({
        host: "localhost",
        path: "/api/v1",
        port: 8082,
        tls: false,
      }),
    ).toBe("http://localhost:8082/api/v1");
  });

  it("round-trips a parsed URL", () => {
    const raw = "http://localhost:8081";
    expect(formatServerUrl(parseServerUrl(raw))).toBe(raw);
  });
});
