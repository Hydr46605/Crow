import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CROW_HOME } from '../config.js';
import {
  BLOCKLIST_CATEGORIES,
  blocklistSchema,
  emptyBlocklist,
  type Blocklist,
  type BlocklistCategory,
  type RouteRule,
} from './types.js';

/** Path of the persisted blocklist under `CROW_HOME`. */
export const blocklistFilePath = (): string => join(CROW_HOME, 'blocklist.json');

/** Splits a comma-separated env value into trimmed, non-empty entries. */
const parseList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

/** Parses categories, dropping values that are not valid category names. */
const parseCategories = (value: string | undefined): BlocklistCategory[] =>
  parseList(value).filter((category): category is BlocklistCategory =>
    (BLOCKLIST_CATEGORIES as readonly string[]).includes(category),
  );

/** Parses `METHOD:/route/glob` entries (method defaults to "*"). */
const parseRoutes = (value: string | undefined): RouteRule[] =>
  parseList(value)
    .map((entry) => {
      const colon = entry.indexOf(':');
      const method = colon === -1 ? '*' : entry.slice(0, colon).trim().toUpperCase();
      const pattern = colon === -1 ? entry.trim() : entry.slice(colon + 1).trim();
      return { method, pattern };
    })
    .filter((rule): rule is RouteRule => rule.pattern.startsWith('/') && rule.pattern.length > 1);

/** Reads env-var overrides that augment the persisted blocklist. */
export const envOverrides = (env: NodeJS.ProcessEnv = process.env): Blocklist => ({
  tools: parseList(env.CROW_BLOCK_TOOLS),
  categories: parseCategories(env.CROW_BLOCK_CATEGORIES),
  routes: parseRoutes(env.CROW_BLOCK_ROUTES),
  guilds: parseList(env.CROW_BLOCK_GUILDS),
});

/** Merges the persisted file with env overrides, deduplicating list fields. */
export const loadBlocklist = (
  path: string = blocklistFilePath(),
  env: NodeJS.ProcessEnv = process.env,
): Blocklist => {
  const file = readBlocklistFile(path);
  const overrides = envOverrides(env);
  return {
    tools: [...new Set([...file.tools, ...overrides.tools])],
    categories: [...new Set([...file.categories, ...overrides.categories])],
    routes: [...file.routes, ...overrides.routes],
    guilds: [...new Set([...file.guilds, ...overrides.guilds])],
  };
};

/** Reads the persisted blocklist, returning an empty list on a missing or invalid file. */
export const readBlocklistFile = (path: string): Blocklist => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const result = blocklistSchema.safeParse(parsed);
    return result.success ? result.data : emptyBlocklist();
  } catch {
    return emptyBlocklist();
  }
};

/** Writes the blocklist to disk, owner-readable (`0600`). */
export const writeBlocklistFile = (path: string, blocklist: Blocklist): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(blocklist, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
};
