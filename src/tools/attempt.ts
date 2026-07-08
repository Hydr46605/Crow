import { toErrorMessage } from '../discord/client.js';

export type Attempt<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

/** Runs `fn` and normalizes any thrown error into a safe `Attempt`. */
export const attempt = async <T>(fn: () => Promise<T>): Promise<Attempt<T>> => {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
};
