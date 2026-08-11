import { toErrorMessage } from '../discord/client.js';

export type Attempt<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

/**
 * Runs `fn` and normalizes any thrown error into a safe `Attempt` whose error
 * is prefixed with the given action label (e.g. `read_messages`).
 */
export const attempt = async <T>(label: string, fn: () => Promise<T>): Promise<Attempt<T>> => {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: `${label} failed: ${toErrorMessage(error)}` };
  }
};
