import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '../../src/discord/retry.js';

const makeResponse = (status: number, retryAfter?: string) => ({
  status,
  headers: { get: (name: string) => (name === 'retry-after' && retryAfter ? retryAfter : null) },
  body: { cancel: vi.fn() },
});

describe('fetchWithRetry', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns immediately on a non-retryable status', async () => {
    const fetchMock = vi.fn(async () => makeResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithRetry('https://x', {});

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 once then succeeds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429, '1'))
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('https://x', {});
    await vi.advanceTimersByTimeAsync(1_000);
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured attempts', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => makeResponse(500));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('https://x', {}, { attempts: 3, baseDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(1_000);
    const response = await promise;

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
