import jwt from "jsonwebtoken";

import type { ConfigManager } from "./config-manager.js";

/** Environment variable that sets the CLI's client ID for a whole session. */
export const CLIENT_ID_ENV_VAR = "ABLY_CLIENT_ID";

/** The JWT claim that carries the client ID an Ably JWT is bound to. */
export const CLIENT_ID_CLAIM = "x-ably-clientId";

/** Deprecated sentinel that opts out of a client ID entirely. */
const NO_CLIENT_ID = "none";

export type ClientIdSource = "flag" | "env" | "config" | "default";

export interface ClientIdentity {
  /** The client ID to act as, or undefined when the user opted out with "none". */
  clientId: string | undefined;
  source: ClientIdSource;
  /** True when the deprecated "none" sentinel was used. */
  optedOut: boolean;
}

const SOURCE_NAMES: Record<ClientIdSource, string> = {
  flag: "--client-id",
  env: CLIENT_ID_ENV_VAR,
  config: "the clientId config setting",
  default: "the generated default client ID",
};

/** A user-supplied client ID the CLI cannot act as. */
export class InvalidClientIdError extends Error {}

/**
 * Reject client IDs that would otherwise fail obscurely: an empty value used
 * to fall back to a random identity silently, and "*" is rejected by the SDK
 * with an error that never names the flag the user typed.
 */
function validateClientId(value: string, source: ClientIdSource): void {
  const origin = SOURCE_NAMES[source];
  if (value.trim() === "") {
    throw new InvalidClientIdError(
      `${origin} must not be empty. Set a client ID, or omit ${origin} to use the default.`,
    );
  }

  if (value === "*") {
    throw new InvalidClientIdError(
      `${origin} cannot be "*". The CLI acts as, and issues tokens to, one concrete client ID.`,
    );
  }
}

function toIdentity(value: string, source: ClientIdSource): ClientIdentity {
  validateClientId(value, source);
  const optedOut = value.toLowerCase() === NO_CLIENT_ID;
  return { clientId: optedOut ? undefined : value, source, optedOut };
}

let processDefaultIdentity: ClientIdentity | undefined;

/**
 * The client ID this process acts as when no --client-id is given:
 * ABLY_CLIENT_ID, then the config setting, then a generated install default
 * persisted in the config. Resolved once per process so every client, every
 * interactive command and every minted token share one identity.
 */
function resolveDefaultClientIdentity(
  configManager: ConfigManager,
): ClientIdentity {
  if (processDefaultIdentity) return processDefaultIdentity;

  const envClientId = process.env[CLIENT_ID_ENV_VAR];
  const configClientId = configManager.getClientId();

  processDefaultIdentity =
    envClientId === undefined
      ? configClientId === undefined
        ? toIdentity(configManager.getDefaultClientId(), "default")
        : toIdentity(configClientId, "config")
      : toIdentity(envClientId, "env");

  return processDefaultIdentity;
}

/**
 * Resolve the client ID to act as: --client-id > ABLY_CLIENT_ID > config
 * setting > generated install default. An explicit flag always wins, so two
 * terminals can still act as different clients.
 *
 * @throws InvalidClientIdError when the winning value is empty or "*".
 */
export function resolveClientIdentity(
  flagValue: string | undefined,
  configManager: ConfigManager,
): ClientIdentity {
  return flagValue === undefined
    ? resolveDefaultClientIdentity(configManager)
    : toIdentity(flagValue, "flag");
}

/** Forget the memoized process identity. For tests only. */
export function resetClientIdentityCache(): void {
  processDefaultIdentity = undefined;
}

export type TokenIdentity =
  | { kind: "jwt"; clientId: string | undefined }
  | { kind: "opaque" };

/**
 * The client ID a token is bound to. A JWT carries it in a readable claim; a
 * native Ably token is opaque, so its identity is only known once Ably
 * accepts it.
 */
export function readTokenIdentity(token: string): TokenIdentity {
  const payload = jwt.decode(token, { json: true });
  if (!payload) return { kind: "opaque" };

  const clientId: unknown = payload[CLIENT_ID_CLAIM];
  return {
    kind: "jwt",
    clientId: typeof clientId === "string" ? clientId : undefined,
  };
}
