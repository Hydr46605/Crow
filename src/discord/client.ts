import { REST } from 'discord.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A Discord REST route, always starting with a slash (e.g. `/channels/{id}/messages`). */
export type ApiRoute = `/${string}`;

/**
 * Thin wrapper around discord.js `REST`.
 *
 * Every Discord-bound tool talks to Discord through this class, so the HTTP
 * mechanics (versioning, auth, rate limiting) live in exactly one place.
 */
export class DiscordClient {
  private readonly rest: REST;

  constructor(token: string) {
    this.rest = new REST({ version: '10' }).setToken(token);
  }

  /** Performs a raw request against the Discord API and returns the parsed body. */
  request<T>(method: HttpMethod, fullRoute: ApiRoute, body?: unknown): Promise<T> {
    switch (method) {
      case 'GET':
        return this.rest.get(fullRoute) as Promise<T>;
      case 'DELETE':
        return this.rest.delete(fullRoute) as Promise<T>;
      case 'POST':
        return this.rest.post(fullRoute, { body }) as Promise<T>;
      case 'PUT':
        return this.rest.put(fullRoute, { body }) as Promise<T>;
      case 'PATCH':
        return this.rest.patch(fullRoute, { body }) as Promise<T>;
      default: {
        const never: never = method;
        throw new Error(`Unsupported HTTP method: ${never}`);
      }
    }
  }
}
