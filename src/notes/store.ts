import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { CROW_HOME } from '../config.js';
import { noteSchema, type Note } from './types.js';

const notesFileSchema = z.array(noteSchema);

/** Maximum number of notes kept before the oldest are dropped. */
export const MAX_NOTES = 1000;

/** Path of the persisted notes under `CROW_HOME`. */
export const notesFilePath = (): string => join(CROW_HOME, 'notes.json');

/** Reads the persisted notes, returning an empty list on a missing or invalid file. */
export const readNotesFile = (path: string): Note[] => {
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const result = notesFileSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
};

/** Writes the notes to disk, owner-readable (`0600`). */
export const writeNotesFile = (path: string, notes: readonly Note[]): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(notes, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
};
