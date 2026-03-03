import { Page } from "playwright/test";
import { config } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  incrementConnectionCount,
  waitForRateLimitIfNeeded,
} from "./test-rate-limiter";
import { waitForRateLimitLock } from "./rate-limit-lock";
import { createSignedConfig } from "./helpers/signing-helper";

// Load environment variables from .env for Playwright tests
const rootEnvPath = resolve(process.cwd(), ".env");
if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

/**
 * Helper function to handle authentication in Web CLI e2e tests
 * @param page Playwright Page object
 * @param apiKey Optional API key, defaults to environment variable
 * @param useQueryParam Whether to add API key as query parameter (default: true)
 * @returns Promise that resolves when authentication is complete
 */
export async function authenticateWebCli(
  page: Page,
  apiKey?: string,
  useQueryParam = true,
): Promise<void> {
  const key =
    apiKey || process.env.E2E_ABLY_API_KEY || process.env.ABLY_API_KEY;
  if (!key) {
    throw new Error(
      "E2E_ABLY_API_KEY or ABLY_API_KEY environment variable is required for e2e tests",
    );
  }

  // Log API key format validation
  if (!process.env.CI || process.env.VERBOSE_TESTS) {
    console.log(`[Auth Helper] API key length: ${key.length}`);
    console.log(
      `[Auth Helper] API key format valid: ${/^.+\..+:.+$/.test(key)}`,
    );
    console.log(
      `[Auth Helper] Using ${useQueryParam ? "query param" : "form"} authentication`,
    );
  }

  // Wait for any ongoing rate limit pause to complete
  await waitForRateLimitLock();

  // Check rate limit before attempting connection
  await waitForRateLimitIfNeeded();

  // If the page already has the API key in query params, just wait for terminal
  const currentUrl = page.url();
  if (currentUrl.includes("apiKey=") || currentUrl.includes("apikey=")) {
    if (!process.env.CI || process.env.VERBOSE_TESTS) {
      console.log("API key already in URL, waiting for terminal...");
    }
    incrementConnectionCount();
    await page.waitForSelector(".xterm", { timeout: 15000 });

    // In CI, wait a bit longer for the connection to stabilize
    if (process.env.CI) {
      if (process.env.VERBOSE_TESTS) {
        console.log(
          "CI environment detected, waiting for connection to stabilize...",
        );
      }
      await page.waitForTimeout(3000);
    }
    return;
  }

  // If we should use query param, sign credentials and add to URL
  if (useQueryParam) {
    if (!process.env.CI || process.env.VERBOSE_TESTS) {
      console.log("Signing credentials and adding to URL...");
    }

    // Sign credentials using test signing helper
    const { signedConfig, signature } = createSignedConfig({
      apiKey: key,
      timestamp: Date.now(),
      bypassRateLimit: true, // Bypass rate limiting for tests
    });

    if (!process.env.CI || process.env.VERBOSE_TESTS) {
      console.log("Generated signed config for authentication");
    }

    const url = new URL(currentUrl);
    url.searchParams.set("signedConfig", signedConfig);
    url.searchParams.set("signature", signature);
    // Always clear credentials in tests to ensure consistent state
    url.searchParams.set("clearCredentials", "true");
    incrementConnectionCount();
    await page.goto(url.toString());

    // Wait for terminal to be visible
    await page.waitForSelector(".xterm", { timeout: 15000 });

    // Additional wait for connection to stabilize
    await page.waitForTimeout(2000);

    // In CI, wait a bit longer for the connection to stabilize
    if (process.env.CI) {
      if (process.env.VERBOSE_TESTS) {
        console.log(
          "CI environment detected, waiting for connection to stabilize...",
        );
      }
      await page.waitForTimeout(3000);
    }
    return;
  }

  // Otherwise, use the form-based authentication
  // Form will call /api/sign endpoint (served by Vite middleware during tests)
  const authScreenVisible = await page
    .locator('input[placeholder="your_app.key_name:key_secret"]')
    .isVisible()
    .catch(() => false);

  if (authScreenVisible) {
    if (!process.env.CI || process.env.VERBOSE_TESTS) {
      console.log("Authentication screen detected, logging in via form...");
    }
    await page.fill('input[placeholder="your_app.key_name:key_secret"]', key);
    incrementConnectionCount();
    await page.click('button:has-text("Connect to Terminal")');
    if (!process.env.CI || process.env.VERBOSE_TESTS) {
      console.log("Authentication submitted (form will call /api/sign).");
    }

    // Wait for terminal to be visible
    await page.waitForSelector(".xterm", { timeout: 15000 });

    // In CI, wait a bit longer for the connection to stabilize
    if (process.env.CI) {
      if (process.env.VERBOSE_TESTS) {
        console.log(
          "CI environment detected, waiting for connection to stabilize...",
        );
      }
      await page.waitForTimeout(3000);
    }
  }
}

/**
 * Helper function to navigate to Web CLI and authenticate
 * @param page Playwright Page object
 * @param url The URL to navigate to
 * @param apiKey Optional API key, defaults to environment variable
 */
export async function navigateAndAuthenticate(
  page: Page,
  url: string,
  apiKey?: string,
): Promise<void> {
  const key =
    apiKey || process.env.E2E_ABLY_API_KEY || process.env.ABLY_API_KEY;
  if (!key) {
    throw new Error(
      "E2E_ABLY_API_KEY or ABLY_API_KEY environment variable is required for e2e tests",
    );
  }

  // Wait for any ongoing rate limit pause to complete
  await waitForRateLimitLock();

  // Check rate limit before attempting connection
  await waitForRateLimitIfNeeded();

  // Sign credentials and add as query parameters
  const { signedConfig, signature } = createSignedConfig({
    apiKey: key,
    timestamp: Date.now(),
    bypassRateLimit: true, // Bypass rate limiting for tests
  });

  const urlWithAuth = new URL(url);
  urlWithAuth.searchParams.set("signedConfig", signedConfig);
  urlWithAuth.searchParams.set("signature", signature);
  // Always clear credentials in tests to ensure consistent state
  urlWithAuth.searchParams.set("clearCredentials", "true");

  incrementConnectionCount();
  await page.goto(urlWithAuth.toString());

  // Wait for terminal to be visible (should auto-authenticate with query param)
  await page.waitForSelector(".xterm", { timeout: 15000 });

  // In CI, wait a bit longer for the connection to stabilize
  if (process.env.CI) {
    console.log(
      "CI environment detected, waiting for connection to stabilize...",
    );
    await page.waitForTimeout(3000);
  }
}
