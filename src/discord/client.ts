import { REST } from 'discord.js';
import { redactSecrets } from '../security/redact.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A Discord REST route. Must start with a slash (e.g. `/channels/{id}/messages`). */
export type ApiRoute = string;

/** A file to attach to a multipart request. Mirrors discord.js `RawFile`. */
export interface DiscordFile {
  readonly name: string;
  readonly data: Buffer;
  readonly contentType?: string;
  readonly key?: string;
}

export interface DiscordRequestOptions {
  readonly body?: unknown;
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly reason?: string;
  readonly files?: readonly DiscordFile[];
  readonly appendToFormData?: boolean;
}

/** Low-level request executor. The default implementation wraps discord.js `REST`. */
export type RequestExecutor = (
  method: HttpMethod,
  fullRoute: ApiRoute,
  options: DiscordRequestOptions,
) => Promise<unknown>;

/** Options for executing a webhook (message send via the webhook's own token). */
export interface WebhookExecuteOptions {
  readonly body?: unknown;
  readonly query?: Record<string, string | number | boolean | undefined>;
}

/**
 * Low-level webhook executor. Webhook execution authenticates with the webhook
 * token in the URL (not the bot token), so it uses `fetch` against the
 * webhook endpoint directly instead of the discord.js `REST` client.
 */
export type WebhookExecutor = (
  webhookId: string,
  webhookToken: string,
  options: WebhookExecuteOptions,
) => Promise<unknown>;

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Error thrown for failed or invalid Discord requests, with secrets redacted. */
export class DiscordRequestError extends Error {
  /** HTTP status code, when the failure came from a Discord REST response. */
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'DiscordRequestError';
    this.statusCode = statusCode;
  }
}

/** Best-effort extraction of an HTTP status from a Discord REST error. */
const extractStatus = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error !== null) {
    const e = error as { status?: unknown; statusCode?: unknown };
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;
  }
  return undefined;
};

interface RestRequestData {
  body?: unknown;
  query?: URLSearchParams;
  reason?: string;
  files?: DiscordFile[];
  appendToFormData?: boolean;
}

const toRequestData = (options: DiscordRequestOptions): RestRequestData => {
  const data: RestRequestData = {};
  if (options.body !== undefined) data.body = options.body;
  if (options.reason !== undefined) data.reason = options.reason;
  if (options.files !== undefined) {
    data.files = options.files.map((file) => ({ ...file }));
  }
  if (options.appendToFormData !== undefined) data.appendToFormData = options.appendToFormData;
  if (options.query) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) query.set(key, String(value));
    }
    data.query = query;
  }
  return data;
};

const WEBHOOK_BASE = 'https://discord.com/api/webhooks';

const createWebhookExecutor = (): WebhookExecutor => {
  return async (webhookId, webhookToken, options) => {
    const url = new URL(`${WEBHOOK_BASE}/${webhookId}/${webhookToken}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 204) return null;

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data ? JSON.stringify(data) : response.statusText;
      throw new DiscordRequestError(detail, response.status);
    }
    return data;
  };
};

const createRestExecutor = (token: string): RequestExecutor => {
  const rest = new REST({ version: '10' }).setToken(token);
  return (method, fullRoute, options) => {
    const route = fullRoute as `/${string}`;
    const data = toRequestData(options);
    switch (method) {
      case 'GET':
        return rest.get(route, data);
      case 'DELETE':
        return rest.delete(route, data);
      case 'POST':
        return rest.post(route, data);
      case 'PUT':
        return rest.put(route, data);
      case 'PATCH':
        return rest.patch(route, data);
      default: {
        const never: never = method;
        throw new Error(`Unsupported HTTP method: ${never}`);
      }
    }
  };
};

/**
 * Thin wrapper around the Discord REST API.
 *
 * Every Discord-bound tool talks to Discord through this class, so the HTTP
 * mechanics (versioning, auth, rate limiting) and token redaction live in
 * exactly one place. A custom executor may be injected for tests.
 */
export class DiscordClient {
  private readonly token: string;
  private readonly execute: RequestExecutor;
  private readonly executeWebhookFn: WebhookExecutor;

  constructor(token: string, execute?: RequestExecutor, executeWebhook?: WebhookExecutor) {
    this.token = token;
    this.execute = execute ?? createRestExecutor(token);
    this.executeWebhookFn = executeWebhook ?? createWebhookExecutor();
  }

  /** Performs a raw request against the Discord API and returns the parsed body. */
  async request<T>(
    method: HttpMethod,
    fullRoute: ApiRoute,
    options: DiscordRequestOptions = {},
  ): Promise<T> {
    if (!fullRoute.startsWith('/')) {
      throw new DiscordRequestError(`Invalid Discord route "${fullRoute}": must start with "/".`);
    }
    try {
      return (await this.execute(method, fullRoute, options)) as T;
    } catch (error) {
      throw new DiscordRequestError(
        redactSecrets(toErrorMessage(error), [this.token]),
        extractStatus(error),
      );
    }
  }

  /**
   * Executes a webhook, sending a message through the webhook's own token.
   *
   * The webhook token is a secret, so it is redacted from any error surfaced.
   */
  async executeWebhook<T>(
    webhookId: string,
    webhookToken: string,
    options: WebhookExecuteOptions = {},
  ): Promise<T> {
    try {
      return (await this.executeWebhookFn(webhookId, webhookToken, options)) as T;
    } catch (error) {
      throw new DiscordRequestError(
        redactSecrets(toErrorMessage(error), [webhookToken]),
        extractStatus(error),
      );
    }
  }
}
