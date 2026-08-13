import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { CROW_HOME } from '../config.js';
import { actionSchema, type Action } from './types.js';

const actionsFileSchema = z.array(actionSchema);

/** Path of the persisted action registry under `CROW_HOME`. */
export const actionsFilePath = (): string => join(CROW_HOME, 'actions.json');

/** Reads the persisted actions, returning an empty list on a missing or invalid file. */
export const readActionsFile = (path: string): Action[] => {
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const result = actionsFileSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
};

/** Writes the actions to disk, owner-readable (`0600`). */
export const writeActionsFile = (path: string, actions: readonly Action[]): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(actions, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
};
