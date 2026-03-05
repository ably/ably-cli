import nock from "nock";

export function mockKeysList(appId: string, keys: Record<string, unknown>[]) {
  return nock("https://control.ably.net")
    .get(`/v1/apps/${appId}/keys`)
    .reply(200, keys);
}

export function buildMockKey(
  appId: string,
  keyId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: keyId,
    appId,
    name: "Test Key",
    key: `${appId}.${keyId}:secret`,
    capability: { "*": ["publish", "subscribe"] },
    created: 1709251200000,
    modified: 1709251200000,
    ...overrides,
  };
}
