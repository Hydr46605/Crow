const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
} as const;

/** Wraps `text` in an ANSI escape code, always resetting afterwards. */
export const paint = (code: string, text: string): string => `${code}${text}${ANSI.reset}`;

export const bold = (text: string): string => paint(ANSI.bold, text);
export const dim = (text: string): string => paint(ANSI.dim, text);
export const red = (text: string): string => paint(ANSI.red, text);
export const green = (text: string): string => paint(ANSI.green, text);
export const yellow = (text: string): string => paint(ANSI.yellow, text);
export const cyan = (text: string): string => paint(ANSI.cyan, text);
