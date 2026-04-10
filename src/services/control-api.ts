import fetch, { type RequestInit } from "node-fetch";
import { CommandError } from "../errors/command-error.js";
import { getCliVersion } from "../utils/version.js";

export interface ControlApiOptions {
  accessToken: string;
  controlHost?: string;
  logErrors?: boolean;
}

export interface App {
  accountId: string;
  apnsAuthType?: "certificate" | "token" | null;
  apnsCertificate?: string | null;
  apnsCertificateConfigured?: boolean;
  apnsIssuerKey?: string | null;
  apnsPrivateKey?: string | null;
  apnsSigningKey?: string | null;
  apnsSigningKeyConfigured?: boolean;
  apnsSigningKeyId?: string | null;
  apnsTopicHeader?: string | null;
  apnsUseSandboxEndpoint?: boolean | null;
  apnsUsesSandboxCert?: boolean;
  created: number;
  fcmProjectId?: string | null;
  fcmServiceAccount?: string | null;
  fcmServiceAccountConfigured?: boolean;
  id: string;
  modified: number;
  name: string;
  status: string;
  tlsOnly: boolean;
  [key: string]: unknown;
}

export interface AppStats {
  appId?: string;
  entries: {
    [key: string]: number;
  };
  intervalId: string;
  schema?: string;
  unit: string;
}

// Since account stats have the same structure as app stats
export type AccountStats = AppStats;

export interface Key {
  appId: string;
  capability: unknown;
  created: number;
  id: string;
  key: string;
  modified: number;
  name: string;
  revocable: boolean;
  status: string;
}

export interface Namespace {
  appId: string;
  authenticated?: boolean;
  batchingEnabled?: boolean;
  batchingInterval?: number | null;
  conflationEnabled?: boolean;
  conflationInterval?: number | null;
  conflationKey?: string;
  created: number;
  exposeTimeSerial?: boolean;
  id: string;
  modified: number;
  mutableMessages?: boolean;
  persistLast?: boolean;
  persisted: boolean;
  populateChannelRegistry?: boolean;
  pushEnabled: boolean;
  tlsOnly?: boolean;
}

export interface Rule {
  _links?: {
    self: string;
  };
  appId: string;
  created: number;
  id: string;
  modified: number;
  requestMode: string;
  ruleType: string;
  source: {
    channelFilter: string;
    type: string;
  };
  target: unknown;
  version: string;
}

// Define RuleData interface for rule creation and updates
export interface RuleData {
  requestMode: string;
  ruleType: string;
  source: {
    channelFilter: string;
    type: string;
  };
  status?: "disabled" | "enabled";
  target: Record<string, unknown>; // Target is highly variable
}

// Type for updating a rule, allowing partial source/target
export interface RuleUpdateData {
  requestMode?: string;
  ruleType?: string;
  source?: Partial<{
    // Allow partial source
    channelFilter: string;
    type: string;
  }>;
  status?: "disabled" | "enabled";
  target?: Partial<Record<string, unknown>>; // Allow partial target
}

export interface Queue {
  amqp: {
    queueName: string;
    uri: string;
  };
  appId: string;
  deadletter: boolean;
  deadletterId: string;
  id: string;
  maxLength: number;
  messages: {
    ready: number;
    total: number;
    unacknowledged: number;
  };
  name: string;
  region: string;
  state: string;
  stats: {
    acknowledgementRate: null | number;
    deliveryRate: null | number;
    publishRate: null | number;
  };
  stomp: {
    destination: string;
    host: string;
    uri: string;
  };
  ttl: number;
}

export interface HelpResponse {
  answer: string;
  links: {
    breadcrumbs: string[];
    description: null | string;
    label: string;
    title: string;
    type: string;
    url: string;
  }[];
}

export interface Conversation {
  messages: {
    content: string;
    role: "assistant" | "user";
  }[];
}

// Response type for Control API /me endpoint
export interface MeResponse {
  account: { id: string; name: string };
  user: { email: string };
}

export class ControlApi {
  private accessToken: string;
  private controlHost: string;

  constructor(options: ControlApiOptions) {
    this.accessToken = options.accessToken;
    this.controlHost = options.controlHost || "control.ably.net";
  }

  // Ask a question to the Ably AI agent
  async askHelp(
    question: string,
    conversation?: Conversation,
  ): Promise<HelpResponse> {
    const payload = {
      question,
      ...(conversation && { context: conversation.messages }),
    };

    return this.request<HelpResponse>("/help", "POST", payload);
  }

  // Create a new app
  async createApp(appData: { name: string; tlsOnly?: boolean }): Promise<App> {
    // First get the account ID from /me endpoint
    const meResponse = await this.getMe();
    const accountId = meResponse.account.id;

    // Use correct path with account ID prefix
    return this.request<App>(`/accounts/${accountId}/apps`, "POST", appData);
  }

  // Create a new key for an app
  async createKey(
    appId: string,
    keyData: {
      capability?: Record<string, string[]>;
      name: string;
    },
  ): Promise<Key> {
    return this.request<Key>(`/apps/${appId}/keys`, "POST", keyData);
  }

  async createNamespace(
    appId: string,
    namespaceData: {
      authenticated?: boolean;
      batchingEnabled?: boolean;
      batchingInterval?: number;
      id: string;
      conflationEnabled?: boolean;
      conflationInterval?: number;
      conflationKey?: string;
      exposeTimeSerial?: boolean;
      mutableMessages?: boolean;
      persistLast?: boolean;
      persisted?: boolean;
      populateChannelRegistry?: boolean;
      pushEnabled?: boolean;
      tlsOnly?: boolean;
    },
  ): Promise<Namespace> {
    return this.request<Namespace>(
      `/apps/${appId}/namespaces`,
      "POST",
      namespaceData,
    );
  }

  async createQueue(
    appId: string,
    queueData: {
      maxLength?: number;
      name: string;
      region?: string;
      ttl?: number;
    },
  ): Promise<Queue> {
    return this.request<Queue>(`/apps/${appId}/queues`, "POST", queueData);
  }

  // Create a new rule with typed RuleData interface
  async createRule(appId: string, ruleData: RuleData): Promise<Rule> {
    return this.request<Rule>(`/apps/${appId}/rules`, "POST", ruleData);
  }

  // Delete an app
  async deleteApp(appId: string): Promise<void> {
    // Delete app uses /apps/{appId} path
    return this.request<void>(`/apps/${appId}`, "DELETE");
  }

  async deleteNamespace(appId: string, namespaceId: string): Promise<void> {
    return this.request<void>(
      `/apps/${appId}/namespaces/${namespaceId}`,
      "DELETE",
    );
  }

  async deleteQueue(appId: string, queueId: string): Promise<void> {
    return this.request<void>(`/apps/${appId}/queues/${queueId}`, "DELETE");
  }

  async deleteRule(appId: string, ruleId: string): Promise<void> {
    return this.request<void>(`/apps/${appId}/rules/${ruleId}`, "DELETE");
  }

  // Get account stats
  async getAccountStats(
    options: {
      by?: string;
      end?: number;
      limit?: number;
      start?: number;
      unit?: string;
    } = {},
  ): Promise<AccountStats[]> {
    const queryParams = new URLSearchParams();
    if (options.start) queryParams.append("start", options.start.toString());
    if (options.end) queryParams.append("end", options.end.toString());
    if (options.by) queryParams.append("by", options.by);
    if (options.limit) queryParams.append("limit", options.limit.toString());
    if (options.unit) queryParams.append("unit", options.unit);

    const queryString = queryParams.toString()
      ? `?${queryParams.toString()}`
      : "";

    // First get the account ID from /me endpoint
    const meResponse = await this.getMe();
    const accountId = meResponse.account.id;

    // Account stats require the account ID in the path
    return this.request<AccountStats[]>(
      `/accounts/${accountId}/stats${queryString}`,
    );
  }

  // Get an app by ID
  async getApp(appId: string): Promise<App> {
    // There's no single app GET endpoint, need to get all apps and filter
    const apps = await this.listApps();
    const app = apps.find((a) => a.id === appId);

    if (!app) {
      throw new Error(`App with ID "${appId}" not found`);
    }

    return app;
  }

  // Get app stats
  async getAppStats(
    appId: string,
    options: {
      by?: string;
      end?: number;
      limit?: number;
      start?: number;
      unit?: string;
    } = {},
  ): Promise<AppStats[]> {
    const queryParams = new URLSearchParams();
    if (options.start) queryParams.append("start", options.start.toString());
    if (options.end) queryParams.append("end", options.end.toString());
    if (options.by) queryParams.append("by", options.by);
    if (options.limit) queryParams.append("limit", options.limit.toString());
    if (options.unit) queryParams.append("unit", options.unit);

    const queryString = queryParams.toString()
      ? `?${queryParams.toString()}`
      : "";

    // App ID-specific operations don't need account ID in the path
    return this.request<AppStats[]>(`/apps/${appId}/stats${queryString}`);
  }

  // Get a specific key by ID, key value, key name (APP_ID.KEY_ID), or label
  async getKey(appId: string, keyIdOrValue: string): Promise<Key> {
    const keys = await this.listKeys(appId);

    const matchingKey = keys.find((k) => {
      // Full key value (contains colon) e.g. "s57drg.3bnE1Q:secretpart"
      if (keyIdOrValue.includes(":") && k.key === keyIdOrValue) return true;
      // Full key name e.g. "s57drg.3bnE1Q"
      if (keyIdOrValue.includes(".") && `${k.appId}.${k.id}` === keyIdOrValue)
        return true;
      // Key ID only e.g. "3bnE1Q"
      if (k.id === keyIdOrValue) return true;
      // Key label/name e.g. "Root"
      if (k.name === keyIdOrValue) return true;
      return false;
    });

    if (!matchingKey) {
      throw new Error(`Key "${keyIdOrValue}" not found`);
    }

    return matchingKey;
  }

  // Get user and account info
  async getMe(): Promise<MeResponse> {
    return this.request<MeResponse>("/me");
  }

  async getNamespace(appId: string, namespaceId: string): Promise<Namespace> {
    return this.request<Namespace>(`/apps/${appId}/namespaces/${namespaceId}`);
  }

  async getRule(appId: string, ruleId: string): Promise<Rule> {
    return this.request<Rule>(`/apps/${appId}/rules/${ruleId}`);
  }

  // Get all apps
  async listApps(): Promise<App[]> {
    // First get the account ID from /me endpoint
    const meResponse = await this.getMe();
    const accountId = meResponse.account.id;

    // Use correct path with account ID prefix
    return this.request<App[]>(`/accounts/${accountId}/apps`);
  }

  // List all keys for an app
  async listKeys(appId: string): Promise<Key[]> {
    return this.request<Key[]>(`/apps/${appId}/keys`);
  }

  // Namespace (Channel Rules) methods
  async listNamespaces(appId: string): Promise<Namespace[]> {
    return this.request<Namespace[]>(`/apps/${appId}/namespaces`);
  }

  // Queues methods
  async listQueues(appId: string): Promise<Queue[]> {
    return this.request<Queue[]>(`/apps/${appId}/queues`);
  }

  // Rules (Integrations) methods
  async listRules(appId: string): Promise<Rule[]> {
    return this.request<Rule[]>(`/apps/${appId}/rules`);
  }

  // Revoke a key
  async revokeKey(appId: string, keyId: string): Promise<void> {
    return this.request<void>(`/apps/${appId}/keys/${keyId}`, "DELETE");
  }

  // Update an app
  async updateApp(appId: string, appData: Partial<App>): Promise<App> {
    return this.request<App>(`/apps/${appId}`, "PATCH", appData);
  }

  // Update an existing key
  async updateKey(
    appId: string,
    keyId: string,
    keyData: {
      capability?: Record<string, string[]>;
      name?: string;
    },
  ): Promise<Key> {
    return this.request<Key>(`/apps/${appId}/keys/${keyId}`, "PATCH", keyData);
  }

  async updateNamespace(
    appId: string,
    namespaceId: string,
    namespaceData: {
      authenticated?: boolean;
      batchingEnabled?: boolean;
      batchingInterval?: number;
      conflationEnabled?: boolean;
      conflationInterval?: number;
      conflationKey?: string;
      exposeTimeSerial?: boolean;
      mutableMessages?: boolean;
      persistLast?: boolean;
      persisted?: boolean;
      populateChannelRegistry?: boolean;
      pushEnabled?: boolean;
      tlsOnly?: boolean;
    },
  ): Promise<Namespace> {
    return this.request<Namespace>(
      `/apps/${appId}/namespaces/${namespaceId}`,
      "PATCH",
      namespaceData,
    );
  }

  // Update a rule with typed RuleData interface
  async updateRule(
    appId: string,
    ruleId: string,
    ruleData: RuleUpdateData,
  ): Promise<Rule> {
    return this.request<Rule>(
      `/apps/${appId}/rules/${ruleId}`,
      "PATCH",
      ruleData,
    );
  }

  // Upload Apple Push Notification Service P12 certificate for an app
  async uploadApnsP12(
    appId: string,
    certificateData: Buffer | string,
    options: {
      password?: string;
      useForSandbox?: boolean;
    } = {},
  ): Promise<App> {
    const certBuffer =
      typeof certificateData === "string"
        ? Buffer.from(certificateData, "base64")
        : certificateData;
    const formData = new FormData();
    formData.append(
      "p12File",
      new Blob([new Uint8Array(certBuffer)], { type: "application/x-pkcs12" }),
      "certificate.p12",
    );
    formData.append("p12Pass", options.password ?? "");

    if (options.useForSandbox) {
      await this.request<App>(`/apps/${appId}/pkcs12`, "POST", formData);
      return this.updateApp(appId, {
        apnsUseSandboxEndpoint: options.useForSandbox,
      });
    }

    return this.request<App>(`/apps/${appId}/pkcs12`, "POST", formData);
  }

  private async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const url = this.controlHost.includes("local")
      ? `http://${this.controlHost}/api/v1${path}`
      : `https://${this.controlHost}/v1${path}`;

    const isFormData = body instanceof FormData;
    const options: RequestInit = {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        ...(!isFormData && { "Content-Type": "application/json" }),
        "Ably-Agent": `ably-cli/${getCliVersion()}`,
      },
      method,
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = isFormData ? body : JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const responseBody = await response.text();
      // Attempt to parse JSON, otherwise use raw text
      let responseData: unknown = responseBody;
      try {
        responseData = JSON.parse(responseBody);
      } catch {
        /* Ignore parsing errors, keep as string */
      }

      // Build a user-friendly error message, including the message from the response if available
      let errorMessage = `API request failed (${response.status} ${response.statusText})`;
      if (
        typeof responseData === "object" &&
        responseData !== null &&
        "message" in responseData &&
        typeof responseData.message === "string"
      ) {
        errorMessage += `: ${responseData.message}`;
      } else if (
        typeof responseData === "string" &&
        responseData.length < 100
      ) {
        // Include short string responses directly
        errorMessage += `: ${responseData}`;
      }

      // Extract structured error fields from the API response
      const errorContext: Record<string, unknown> = {};
      if (typeof responseData === "object" && responseData !== null) {
        const data = responseData as Record<string, unknown>;
        if (typeof data.code === "number") {
          errorContext.errorCode = data.code;
        }
        if (typeof data.href === "string") {
          errorContext.helpUrl = data.href;
        }
      }

      throw new CommandError(errorMessage, {
        statusCode: response.status,
        context: errorContext,
      });
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }
}
