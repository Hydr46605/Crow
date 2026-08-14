/** HTTP statuses that are safe to retry (transient server or rate-limit failures). */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Parses a Retry-After header (seconds) into milliseconds, or null. */
const parseRetryAfter = (value: string | null): number | null => {
  if (value === null) return null;
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 0 ? seconds * 1000 : null;
};

export interface RetryOptions {
  readonly attempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

const DEFAULTS = { attempts: 3, baseDelayMs: 500, maxDelayMs: 5000 } as const;

/**
 * Fetches a URL, retrying transient failures (408, 429, 5xx) with exponential
 * backoff. Returns the first non-retryable response; the caller reads its body.
 *
 * The raw `fetch` paths (webhook execution, interaction callbacks) don't ride
 * discord.js `REST`, so they get rate-limit and retry handling here.
 */
export const fetchWithRetry = async (
  url: string | URL,
  init: RequestInit,
  options: RetryOptions = {},
): Promise<Response> => {
  const attempts = options.attempts ?? DEFAULTS.attempts;
  const baseDelayMs = options.baseDelayMs ?? DEFAULTS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);
    if (!RETRYABLE_STATUSES.has(response.status) || attempt >= attempts - 1) {
      return response;
    }
    await response.body?.cancel();
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    const delay = retryAfter ?? Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
    await sleep(delay);
  }
};
