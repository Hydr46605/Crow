import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { NoteRuntime } from '../../src/notes/runtime.js';
import { addNote, clearNotes, listNotes, removeNote } from '../../src/tools/notes.js';
import { createContext, textOf } from '../helpers.js';

const makeCtx = () => {
  const dir = mkdtempSync(join(tmpdir(), 'crow-notes-'));
  const notes = new NoteRuntime(join(dir, 'notes.json'));
  const discord = new DiscordClient('token', async () => null);
  return { ctx: createContext(discord, undefined, notes), dir };
};

describe('note tools', () => {
  it('adds and lists a note', async () => {
    const { ctx, dir } = makeCtx();
    try {
      const added = await addNote({ targetType: 'channel', targetId: 'c1', text: 'logs channel' }, ctx);
      expect(JSON.parse(textOf(added))).toMatchObject({
        targetType: 'channel',
        targetId: 'c1',
        text: 'logs channel',
      });

      const listed = await listNotes({ targetId: 'c1' }, ctx);
      expect(JSON.parse(textOf(listed))).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('removes and clears notes', async () => {
    const { ctx, dir } = makeCtx();
    try {
      const added = await addNote({ targetType: 'user', targetId: 'u1', text: 'a' }, ctx);
      const id = JSON.parse(textOf(added)).id;

      const removed = await removeNote({ noteId: id }, ctx);
      expect(textOf(removed)).toContain('Removed note');

      await addNote({ targetType: 'user', targetId: 'u1', text: 'b' }, ctx);
      const cleared = await clearNotes({ targetType: 'user', targetId: 'u1' }, ctx);
      expect(textOf(cleared)).toContain('Removed 1 note');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
