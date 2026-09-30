import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";

import {
  CLIENT_TYPE_CLAIM,
  createPubSubHttpClient,
  createPubSubRealtimeClient,
  resolveClientSide,
  tokenHasServerClaim,
} from "../../../src/services/ably-client-factory.js";

const KEY = "appId.keyId:keySecret";

function signJwt(claims: Record<string, unknown>): string {
  return jwt.sign(claims, "keySecret", {
    algorithm: "HS256",
    keyid: "appId.keyId",
  });
}

function agentsOf(client: unknown): Record<string, unknown> {
  return (
    (client as { options: { agents?: Record<string, unknown> } }).options
      .agents ?? {}
  );
}

describe("ably-client-factory", () => {
  describe("resolveClientSide", () => {
    it("treats API-key auth as server", () => {
      expect(resolveClientSide({})).toBe("server");
    });

    it("treats a JWT with the server claim as server", () => {
      const token = signJwt({ [CLIENT_TYPE_CLAIM]: "server" });
      expect(resolveClientSide({ token })).toBe("server");
    });

    it("treats a JWT without the server claim as device", () => {
      const token = signJwt({ "x-ably-clientId": "alice" });
      expect(resolveClientSide({ token })).toBe("device");
    });

    it("treats a JWT with a non-server client type as device", () => {
      const token = signJwt({ [CLIENT_TYPE_CLAIM]: "device" });
      expect(resolveClientSide({ token })).toBe("device");
    });

    it("treats an opaque native Ably token as device", () => {
      expect(resolveClientSide({ token: "xVLyHw.opaque-token-value" })).toBe(
        "device",
      );
    });
  });

  describe("tokenHasServerClaim", () => {
    it("returns false for a malformed token", () => {
      expect(tokenHasServerClaim("not.a.jwt")).toBe(false);
    });
  });

  describe("createPubSubHttpClient", () => {
    it("declares the server side via the server package agent", () => {
      const client = createPubSubHttpClient({ key: KEY });
      expect(agentsOf(client)).toHaveProperty("ably-pubsub-server");
      expect(agentsOf(client)).not.toHaveProperty("ably-pubsub-device");
    });

    it("throws for an explicit device side", () => {
      expect(() =>
        createPubSubHttpClient({ token: "opaque", logLevel: 0 }, "device"),
      ).toThrow("A device-side client cannot be an HTTP client.");
    });

    it("throws for a token that resolves to the device side", () => {
      expect(() =>
        createPubSubHttpClient({
          token: signJwt({ "x-ably-clientId": "alice" }),
          logLevel: 0,
        }),
      ).toThrow("A device-side client cannot be an HTTP client.");
    });

    it("creates a server client for a token with the server claim", () => {
      const client = createPubSubHttpClient({
        token: signJwt({
          [CLIENT_TYPE_CLAIM]: "server",
          "x-ably-clientId": "worker",
        }),
        logLevel: 0,
      });
      expect(agentsOf(client)).toHaveProperty("ably-pubsub-server");
    });

    it("preserves the CLI's own agent entries", () => {
      const client = createPubSubHttpClient({
        key: KEY,
        agents: { "ably-cli": "1.0.0" },
      } as Parameters<typeof createPubSubHttpClient>[0]);
      expect(agentsOf(client)).toMatchObject({ "ably-cli": "1.0.0" });
    });
  });

  describe("createPubSubRealtimeClient", () => {
    it("uses the server package for API-key auth", () => {
      const client = createPubSubRealtimeClient({
        key: KEY,
        autoConnect: false,
      });
      expect(agentsOf(client)).toHaveProperty("ably-pubsub-server");
      client.close();
    });

    it("uses the device package for a token without the server claim", () => {
      const client = createPubSubRealtimeClient({
        token: signJwt({ "x-ably-clientId": "alice" }),
        logLevel: 0,
        autoConnect: false,
      });
      expect(agentsOf(client)).toHaveProperty("ably-pubsub-device");
      client.close();
    });
  });
});
