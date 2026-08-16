import { randomUUID } from 'node:crypto';
import { MAX_NOTES, notesFilePath, readNotesFile, writeNotesFile } from './store.js';
import type { Note } from './types.js';

export interface AddNoteInput {
  readonly targetType: string;
  readonly targetId: string;
  readonly text: string;
  readonly key?: string;
}

export interface ListNotesFilter {
  readonly targetType?: string;
  readonly targetId?: string;
  readonly query?: string;
}

/**
 * Local, informational note store backed by a JSON file under `CROW_HOME`.
 *
 * Notes are read fresh from disk on every operation, so multiple agent sessions
 * see each other's context immediately. A note with a `key` is upserted by
 * `(targetType, targetId, key)`; keyless notes always append.
 */
export class NoteRuntime {
  constructor(private readonly storePath: string = notesFilePath()) {}

  add(input: AddNoteInput): Note {
    const notes = readNotesFile(this.storePath);
    const now = new Date().toISOString();

    if (input.key !== undefined) {
      const existing = notes.find(
        (n) => n.targetType === input.targetType && n.targetId === input.targetId && n.key === input.key,
      );
      if (existing) {
        const updated: Note = { ...existing, text: input.text, updatedAt: now };
        writeNotesFile(
          this.storePath,
          notes.map((n) => (n.id === existing.id ? updated : n)),
        );
        return updated;
      }
    }

    const note: Note = {
      id: randomUUID(),
      targetType: input.targetType,
      targetId: input.targetId,
      key: input.key,
      text: input.text,
      createdAt: now,
      updatedAt: now,
    };
    writeNotesFile(this.storePath, [...notes, note].slice(-MAX_NOTES));
    return note;
  }

  list(filter: ListNotesFilter = {}): Note[] {
    const notes = readNotesFile(this.storePath);
    const query = filter.query?.trim().toLowerCase();
    return notes.filter((n) => {
      if (filter.targetType !== undefined && n.targetType !== filter.targetType) return false;
      if (filter.targetId !== undefined && n.targetId !== filter.targetId) return false;
      if (query) {
        const haystack = `${n.text} ${n.key ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  remove(noteId: string): boolean {
    const notes = readNotesFile(this.storePath);
    const next = notes.filter((n) => n.id !== noteId);
    if (next.length === notes.length) return false;
    writeNotesFile(this.storePath, next);
    return true;
  }

  clear(targetType: string, targetId: string): number {
    const notes = readNotesFile(this.storePath);
    const next = notes.filter((n) => !(n.targetType === targetType && n.targetId === targetId));
    const removed = notes.length - next.length;
    if (removed > 0) writeNotesFile(this.storePath, next);
    return removed;
  }
}
