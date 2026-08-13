/**
 * Parsing for local server URLs supplied to `ably accounts login --local`.
 *
 * The Ably SDK takes routing as three separate client options (`endpoint`,
 * `port`/`tlsPort`, `tls`) rather than a URL, and the Control API takes a bare
 * host. A single `--url http://localhost:8081` is far easier to type and to
 * remember than three flags, so we accept a URL and decompose it here.
 */

/** A local server URL decomposed into the parts the SDK and Control API need. */
export interface ServerUrl {
  /** Hostname with no scheme, port, or path — the SDK's `endpoint` option. */
  host: string;
  /** Path component, normalised to "" when the URL has none. */
  path: string;
  /** Port, or undefined when the URL relies on the scheme default. */
  port?: number;
  /** True for https, false for http. */
  tls: boolean;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const SCHEME_PATTERN = /^[a-z][\d+.a-z-]*:\/\//i;

function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}

/**
 * Parse a local server URL into its SDK-facing parts.
 *
 * Accepts a full URL ("http://localhost:8081") or a bare host and port
 * ("localhost:8081"). Schemeless input defaults to http for loopback hosts and
 * https for everything else, so the common local case needs no scheme while a
 * remote host is never silently downgraded to plaintext.
 *
 * @throws Error with a user-facing message when the input cannot be parsed.
 */
export function parseServerUrl(raw: string): ServerUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("URL cannot be empty.");
  }

  const hasScheme = SCHEME_PATTERN.test(trimmed);

  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `http://${trimmed}`);
  } catch {
    throw new Error(
      `Invalid URL "${raw}". Expected a value like http://localhost:8081.`,
    );
  }

  if (hasScheme && url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `Unsupported scheme "${url.protocol.replace(":", "")}" in "${raw}". Use http:// or https://.`,
    );
  }

  if (!url.hostname) {
    throw new Error(
      `Invalid URL "${raw}". Expected a value like http://localhost:8081.`,
    );
  }

  // Nothing downstream can carry these, and dropping them silently would
  // resurface later as an unrelated auth or routing error. Rejecting them is
  // the same choice made for paths below.
  if (url.username || url.password) {
    throw new Error(
      `Credentials are not supported in "${raw}". Pass the API key separately.`,
    );
  }

  if (url.search || url.hash) {
    throw new Error(
      `Query strings and fragments are not supported in "${raw}". Expected a value like http://localhost:8081.`,
    );
  }

  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");

  return {
    host: url.hostname,
    path,
    port: url.port ? Number.parseInt(url.port, 10) : undefined,
    tls: hasScheme ? url.protocol === "https:" : !isLoopback(url.hostname),
  };
}

/**
 * Render a parsed server URL back to a canonical string, for display and for
 * storing the control plane base URL in config.
 */
export function formatServerUrl(server: ServerUrl): string {
  const scheme = server.tls ? "https" : "http";
  const port = server.port === undefined ? "" : `:${server.port}`;
  return `${scheme}://${server.host}${port}${server.path}`;
}

/**
 * Render stored routing — the SDK's `endpoint`/`port`/`tls` triple, as held on
 * an account or resolved from flags and environment — as a URL, or undefined
 * when no endpoint is configured.
 *
 * Every place that reports which server a command is pointed at goes through
 * this, so a server is always identified the same way: by URL, never by a bare
 * hostname that hides the port and the scheme.
 */
export function formatEndpointUrl(routing?: {
  endpoint?: string;
  port?: number;
  tls?: boolean;
}): string | undefined {
  if (!routing?.endpoint) return undefined;

  return formatServerUrl({
    host: routing.endpoint,
    path: "",
    port: routing.port,
    tls: routing.tls ?? true,
  });
}
