/** Returns a masked token safe for display in logs and errors. */
export const maskToken = (token: string): string => {
  if (token.length <= 8) return '********';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
};

/**
 * Replaces every occurrence of each secret in `text` with `[REDACTED]`.
 *
 * Empty secrets are ignored. Used to keep credentials out of logs and
 * error messages returned to clients.
 */
export const redactSecrets = (text: string, secrets: readonly string[]): string => {
  let redacted = text;
  for (const secret of secrets) {
    if (secret.length > 0) {
      redacted = redacted.split(secret).join('[REDACTED]');
    }
  }
  return redacted;
};
