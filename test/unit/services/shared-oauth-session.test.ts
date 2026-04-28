import { describe, it, expect, beforeEach } from "vitest";
import { getMockConfigManager } from "../../helpers/mock-config-manager.js";

describe("Shared OAuth session", () => {
  let mock: ReturnType<typeof getMockConfigManager>;

  beforeEach(() => {
    mock = getMockConfigManager();
    mock.clearAccounts();
  });

  it("two aliases with the same userEmail share one session", () => {
    mock.storeOAuthTokens(
      "alias-a",
      {
        accessToken: "at_1",
        refreshToken: "rt_1",
        expiresAt: Date.now() + 3600000,
        userEmail: "user@example.com",
      },
      { accountId: "acc-a", accountName: "Account A" },
    );
    mock.storeOAuthTokens(
      "alias-b",
      {
        accessToken: "at_1",
        refreshToken: "rt_1",
        expiresAt: Date.now() + 3600000,
        userEmail: "user@example.com",
      },
      { accountId: "acc-b", accountName: "Account B" },
    );

    const config = mock.getConfig();
    expect(config.accounts["alias-a"].oauthSessionKey).toBe(
      "user@example.com::ably.com",
    );
    expect(config.accounts["alias-b"].oauthSessionKey).toBe(
      "user@example.com::ably.com",
    );
    // Only one session entry
    expect(Object.keys(config.oauthSessions!)).toHaveLength(1);
  });

  it("refreshing one alias propagates tokens to all sharing aliases", () => {
    // Initial store for both aliases
    mock.storeOAuthTokens(
      "alias-a",
      {
        accessToken: "at_old",
        refreshToken: "rt_old",
        expiresAt: Date.now() + 3600000,
        userEmail: "user@example.com",
      },
      { accountId: "acc-a", accountName: "Account A" },
    );
    mock.storeOAuthTokens(
      "alias-b",
      {
        accessToken: "at_old",
        refreshToken: "rt_old",
        expiresAt: Date.now() + 3600000,
        userEmail: "user@example.com",
      },
      { accountId: "acc-b", accountName: "Account B" },
    );

    // Simulate token refresh while on alias-a
    mock.switchAccount("alias-a");
    mock.storeOAuthTokens("alias-a", {
      accessToken: "at_new",
      refreshToken: "rt_new",
      expiresAt: Date.now() + 7200000,
      userEmail: "user@example.com",
    });

    // Switch to alias-b — should see the refreshed tokens
    mock.switchAccount("alias-b");
    expect(mock.getAccessToken()).toBe("at_new");
    expect(mock.getOAuthTokens()?.refreshToken).toBe("rt_new");
  });

  it("different userEmails get separate sessions", () => {
    mock.storeOAuthTokens(
      "alias-a",
      {
        accessToken: "at_a",
        refreshToken: "rt_a",
        expiresAt: Date.now() + 3600000,
        userEmail: "user1@example.com",
      },
      { accountId: "acc-a", accountName: "Account A" },
    );
    mock.storeOAuthTokens(
      "alias-b",
      {
        accessToken: "at_b",
        refreshToken: "rt_b",
        expiresAt: Date.now() + 3600000,
        userEmail: "user2@example.com",
      },
      { accountId: "acc-b", accountName: "Account B" },
    );

    const config = mock.getConfig();
    expect(Object.keys(config.oauthSessions!)).toHaveLength(2);
    expect(config.accounts["alias-a"].oauthSessionKey).toBe(
      "user1@example.com::ably.com",
    );
    expect(config.accounts["alias-b"].oauthSessionKey).toBe(
      "user2@example.com::ably.com",
    );

    // Refreshing alias-a should NOT affect alias-b
    mock.switchAccount("alias-a");
    mock.storeOAuthTokens("alias-a", {
      accessToken: "at_a_new",
      refreshToken: "rt_a_new",
      expiresAt: Date.now() + 7200000,
      userEmail: "user1@example.com",
    });

    mock.switchAccount("alias-b");
    expect(mock.getOAuthTokens()?.accessToken).toBe("at_b");
    expect(mock.getOAuthTokens()?.refreshToken).toBe("rt_b");
  });

  it("getAliasesForOAuthSession returns all sharing aliases", () => {
    mock.storeOAuthTokens(
      "work",
      {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: Date.now() + 3600000,
        userEmail: "user@example.com",
      },
      { accountId: "acc-1", accountName: "Work" },
    );
    mock.storeOAuthTokens(
      "personal",
      {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: Date.now() + 3600000,
        userEmail: "user@example.com",
      },
      { accountId: "acc-2", accountName: "Personal" },
    );

    const aliases = mock.getAliasesForOAuthSession("work");
    expect(aliases).toContain("work");
    expect(aliases).toContain("personal");
    expect(aliases).toHaveLength(2);
  });

  it("removing last alias for a session cleans up the session entry", () => {
    mock.storeOAuthTokens(
      "only-alias",
      {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: Date.now() + 3600000,
        userEmail: "user@example.com",
      },
      { accountId: "acc-1", accountName: "Only" },
    );

    expect(mock.getConfig().oauthSessions).toBeDefined();
    mock.removeAccount("only-alias");
    expect(mock.getConfig().oauthSessions).toBeUndefined();
  });

  it("removing one alias keeps session when other aliases still reference it", () => {
    mock.storeOAuthTokens(
      "alias-a",
      {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: Date.now() + 3600000,
        userEmail: "user@example.com",
      },
      { accountId: "acc-a", accountName: "A" },
    );
    mock.storeOAuthTokens(
      "alias-b",
      {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: Date.now() + 3600000,
        userEmail: "user@example.com",
      },
      { accountId: "acc-b", accountName: "B" },
    );

    mock.removeAccount("alias-a");

    // Session should still exist for alias-b
    const config = mock.getConfig();
    expect(config.oauthSessions?.["user@example.com::ably.com"]).toBeDefined();
    expect(mock.getOAuthTokens("alias-b")?.refreshToken).toBe("rt");
  });

  it("refreshToken is stored only in the session, not the account", () => {
    mock.storeOAuthTokens(
      "test",
      {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: Date.now() + 3600000,
        userEmail: "user@example.com",
      },
      { accountId: "acc-1", accountName: "Test" },
    );

    mock.switchAccount("test");
    expect(mock.getOAuthTokens()?.refreshToken).toBe("rt");
    expect(mock.getAccessToken()).toBe("at");
  });
});
