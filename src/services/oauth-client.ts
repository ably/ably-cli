import { createHash, randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import fetch from "node-fetch";

import { getErrorPage, getSuccessPage } from "./oauth-callback-page.js";

export interface OAuthTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
  scope?: string;
  tokenType: string;
  userEmail?: string;
  userId?: string;
}

export interface OAuthConfig {
  authorizationEndpoint: string;
  clientId: string;
  revocationEndpoint: string;
  scopes: string[];
  tokenEndpoint: string;
}

export interface OAuthClientOptions {
  controlHost?: string;
}

export class OAuthClient {
  private config: OAuthConfig;

  constructor(options: OAuthClientOptions = {}) {
    this.config = this.getOAuthConfig(options.controlHost);
  }

  /**
   * Perform the full OAuth login flow:
   * 1. Generate PKCE verifier + challenge
   * 2. Start localhost callback server
   * 3. Return the authorization URL (caller opens browser)
   * 4. Wait for callback with auth code
   * 5. Exchange code for tokens
   */
  async login(
    openBrowser: (url: string) => Promise<void>,
  ): Promise<OAuthTokens> {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();

    const { authorizationCode, redirectUri } = await this.startCallbackServer(
      state,
      (port) => {
        const redirectUri = `http://127.0.0.1:${port}/callback`;
        const authUrl = this.buildAuthorizationUrl(
          redirectUri,
          codeChallenge,
          state,
        );
        return { authUrl, redirectUri };
      },
      openBrowser,
    );

    return this.exchangeCodeForTokens(
      authorizationCode,
      redirectUri,
      codeVerifier,
    );
  }

  /**
   * Refresh an access token using a refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    return this.postForTokens(
      {
        client_id: this.config.clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      },
      "Token refresh",
    );
  }

  /**
   * Revoke a token (access or refresh)
   */
  async revokeToken(token: string): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      token,
    });

    try {
      await fetch(this.config.revocationEndpoint, {
        body: params.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      });
    } catch {
      // Best-effort revocation -- don't block on failure
    }
  }

  getClientId(): string {
    return this.config.clientId;
  }

  // --- Private helpers ---

  private getOAuthConfig(controlHost = "ably.com"): OAuthConfig {
    const host = controlHost;
    const scheme = host.includes("local") ? "http" : "https";
    return {
      authorizationEndpoint: `${scheme}://${host}/oauth/authorize`,
      clientId: "_YfP7jQzCscq8nAxvx0CKPx9zKNx3vcdp0QEDNAAdow",
      revocationEndpoint: `${scheme}://${host}/oauth/revoke`,
      scopes: ["full_access"],
      tokenEndpoint: `${scheme}://${host}/oauth/token`,
    };
  }

  generateCodeVerifier(): string {
    return randomBytes(32).toString("base64url");
  }

  generateCodeChallenge(verifier: string): string {
    return createHash("sha256").update(verifier).digest("base64url");
  }

  generateState(): string {
    return randomBytes(16).toString("base64url");
  }

  private buildAuthorizationUrl(
    redirectUri: string,
    codeChallenge: string,
    state: string,
  ): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: this.config.scopes.join(" "),
      state,
    });
    return `${this.config.authorizationEndpoint}?${params.toString()}`;
  }

  private startCallbackServer(
    expectedState: string,
    buildUrls: (port: number) => { authUrl: string; redirectUri: string },
    openBrowser: (url: string) => Promise<void>,
  ): Promise<{ authorizationCode: string; redirectUri: string }> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      let redirectUri = "";

      const server: Server = createServer(
        (req: IncomingMessage, res: ServerResponse) => {
          const url = new URL(req.url || "/", `http://127.0.0.1`);

          if (url.pathname !== "/callback") {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
            return;
          }

          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          if (error) {
            const description =
              url.searchParams.get("error_description") || error;
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(getErrorPage(description));
            if (!resolved) {
              resolved = true;
              cleanup();
              reject(new Error(`OAuth authorization failed: ${description}`));
            }
            return;
          }

          if (!code || state !== expectedState) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(getErrorPage("Invalid callback parameters"));
            if (!resolved) {
              resolved = true;
              cleanup();
              reject(
                new Error(
                  "Invalid OAuth callback: missing code or state mismatch",
                ),
              );
            }
            return;
          }

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(getSuccessPage());

          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({ authorizationCode: code, redirectUri });
          }
        },
      );

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error("OAuth login timed out after 120 seconds"));
        }
      }, 120_000);

      const cleanup = () => {
        clearTimeout(timeout);
        server.close();
      };

      // Bind to loopback only, ephemeral port
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          resolved = true;
          cleanup();
          reject(new Error("Failed to start callback server"));
          return;
        }

        const port = address.port;
        const urls = buildUrls(port);
        redirectUri = urls.redirectUri;

        openBrowser(urls.authUrl).catch((error) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            reject(new Error(`Failed to open browser: ${error}`));
          }
        });
      });

      server.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error(`Callback server error: ${err.message}`));
        }
      });
    });
  }

  private async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<OAuthTokens> {
    return this.postForTokens(
      {
        client_id: this.config.clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      },
      "Token exchange",
    );
  }

  private async postForTokens(
    params: Record<string, string>,
    operationName: string,
  ): Promise<OAuthTokens> {
    const body = new URLSearchParams(params);

    const response = await fetch(this.config.tokenEndpoint, {
      body: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `${operationName} failed (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.parseTokenResponse(data);
  }

  private parseTokenResponse(data: Record<string, unknown>): OAuthTokens {
    const expiresIn = (data.expires_in as number) || 3600;
    return {
      accessToken: data.access_token as string,
      expiresAt: Date.now() + expiresIn * 1000,
      refreshToken: data.refresh_token as string,
      scope: data.scope as string | undefined,
      tokenType: (data.token_type as string) || "Bearer",
      userEmail: data.user_email as string | undefined,
      userId: data.user_id === undefined ? undefined : String(data.user_id),
    };
  }
}
