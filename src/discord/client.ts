import { REST } from 'discord.js';
import { redactSecrets } from '../security/redact.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A Discord REST route. Must start with a slash (e.g. `/channels/{id}/messages`). */
export type ApiRoute = string;

export interface DiscordRequestOptions {
  readonly body?: unknown;
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly reason?: string;
}

/** Low-level request executor. The default implementation wraps discord.js `REST`. */
export type RequestExecutor = (
  method: HttpMethod,
  fullRoute: ApiRoute,
  options: DiscordRequestOptions,
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
}

const toRequestData = (options: DiscordRequestOptions): RestRequestData => {
  const data: RestRequestData = {};
  if (options.body !== undefined) data.body = options.body;
  if (options.reason !== undefined) data.reason = options.reason;
  if (options.query) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) query.set(key, String(value));
    }
    data.query = query;
  }
  return data;
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

  constructor(token: string, execute?: RequestExecutor) {
    this.token = token;
    this.execute = execute ?? createRestExecutor(token);
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
}
