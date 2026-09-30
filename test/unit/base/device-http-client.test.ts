import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import jwt from "jsonwebtoken";

import { getMockAblyRest } from "../../helpers/mock-ably-rest.js";

function signJwt(claims: Record<string, unknown>): string {
  return jwt.sign(claims, "keySecret", {
    algorithm: "HS256",
    keyid: "appId.keyId",
  });
}

describe("HTTP commands under device classification", () => {
  afterEach(() => {
    delete process.env.ABLY_TOKEN;
  });

  it("fail for a token without the server claim", async () => {
    process.env.ABLY_TOKEN = signJwt({ "x-ably-clientId": "alice" });

    const { error } = await runCommand(
      ["channels:history", "test-channel"],
      import.meta.url,
    );

    expect(error?.message).toContain("only server-side clients can use");
    expect(error?.message).toContain("--client-type server");
    expect(
      getMockAblyRest().channels._getChannel("test-channel").history,
    ).not.toHaveBeenCalled();
  });

  it("fail for an opaque native Ably token", async () => {
    process.env.ABLY_TOKEN = "xVLyHw.opaque-token";

    const { error } = await runCommand(
      ["channels:history", "test-channel"],
      import.meta.url,
    );

    expect(error?.message).toContain("only server-side clients can use");
  });

  it("run for a token with the server claim", async () => {
    process.env.ABLY_TOKEN = signJwt({
      "x-ably-clientId": "worker",
      "x-ably-clientType": "server",
    });

    const { error } = await runCommand(
      ["channels:history", "test-channel"],
      import.meta.url,
    );

    expect(error).toBeUndefined();
  });
});
