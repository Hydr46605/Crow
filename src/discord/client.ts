import { REST } from 'discord.js';
import { redactSecrets } from '../security/redact.js';
import { fetchWithRetry } from './retry.js';

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
  readonly files?: readonly DiscordFile[];
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

/** The payload for an interaction callback (types 4 or 9). */
export interface InteractionCallback {
  readonly type: 4 | 9;
  readonly data: unknown;
}

/**
 * Low-level interaction callback executor. Callbacks authenticate with the
 * interaction's own token in the URL (not the bot token), so they use `fetch`
 * against the interaction endpoint directly instead of the discord.js `REST`
 * client.
 */
export type InteractionCallbackExecutor = (
  interactionId: string,
  interactionToken: string,
  callback: InteractionCallback,
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

const INTERACTION_BASE = 'https://discord.com/api/interactions';

const createInteractionCallbackExecutor = (): InteractionCallbackExecutor => {
  return async (interactionId, interactionToken, callback) => {
    const url = `${INTERACTION_BASE}/${interactionId}/${interactionToken}/callback`;
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callback),
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

const WEBHOOK_BASE = 'https://discord.com/api/webhooks';

/** Builds a multipart webhook request when files are attached. */
const buildWebhookMultipart = (body: unknown, files: readonly DiscordFile[]): RequestInit => {
  const form = new FormData();
  form.append('payload_json', JSON.stringify(body ?? {}));
  files.forEach((file, index) => {
    form.append(
      `files[${index}]`,
      new Blob([file.data], { type: file.contentType ?? 'application/octet-stream' }),
      file.name,
    );
  });
  return { method: 'POST', body: form };
};

const createWebhookExecutor = (): WebhookExecutor => {
  return async (webhookId, webhookToken, options) => {
    const url = new URL(`${WEBHOOK_BASE}/${webhookId}/${webhookToken}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const files = options.files ?? [];
    const init: RequestInit =
      files.length > 0
        ? buildWebhookMultipart(options.body, files)
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
          };

    const response = await fetchWithRetry(url, init);

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
  private readonly executeInteractionCallbackFn: InteractionCallbackExecutor;

  constructor(
    token: string,
    execute?: RequestExecutor,
    executeWebhook?: WebhookExecutor,
    executeInteractionCallback?: InteractionCallbackExecutor,
  ) {
    this.token = token;
    this.execute = execute ?? createRestExecutor(token);
    this.executeWebhookFn = executeWebhook ?? createWebhookExecutor();
    this.executeInteractionCallbackFn = executeInteractionCallback ?? createInteractionCallbackExecutor();
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

  /**
   * Sends an interaction callback (message or modal) through the interaction's
   * own token. The interaction token is a secret, so it is redacted from any
   * error surfaced.
   */
  async interactionCallback<T>(
    interactionId: string,
    interactionToken: string,
    callback: InteractionCallback,
  ): Promise<T> {
    try {
      return (await this.executeInteractionCallbackFn(interactionId, interactionToken, callback)) as T;
    } catch (error) {
      throw new DiscordRequestError(
        redactSecrets(toErrorMessage(error), [interactionToken]),
        extractStatus(error),
      );
    }
  }
}
