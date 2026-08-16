import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NoteRuntime } from '../../src/notes/runtime.js';

const makeRuntime = (): { runtime: NoteRuntime; dir: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'crow-notes-'));
  return { runtime: new NoteRuntime(join(dir, 'notes.json')), dir };
};

describe('NoteRuntime', () => {
  it('appends keyless notes and stamps them', () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.add({ targetType: 'user', targetId: 'u1', text: 'prefers embeds' });
      runtime.add({ targetType: 'user', targetId: 'u1', text: 'is a moderator' });

      const notes = runtime.list();
      expect(notes).toHaveLength(2);
      expect(notes[0]).toMatchObject({ targetType: 'user', targetId: 'u1', text: 'prefers embeds' });
      expect(notes[0].id).toBeTruthy();
      expect(notes[0].createdAt).toBeTruthy();
      expect(notes[0].updatedAt).toBe(notes[0].createdAt);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('upserts by key instead of appending a duplicate', () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.add({ targetType: 'guild', targetId: 'g1', key: 'rules', text: 'first' });
      runtime.add({ targetType: 'guild', targetId: 'g1', key: 'rules', text: 'second' });

      const notes = runtime.list();
      expect(notes).toHaveLength(1);
      expect(notes[0].text).toBe('second');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('filters by target type, target id, and text query', () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.add({ targetType: 'user', targetId: 'u1', text: 'likes cats' });
      runtime.add({ targetType: 'user', targetId: 'u2', text: 'likes dogs' });
      runtime.add({ targetType: 'channel', targetId: 'c1', text: 'rules channel' });

      expect(runtime.list({ targetType: 'user' })).toHaveLength(2);
      expect(runtime.list({ targetId: 'c1' })).toHaveLength(1);
      expect(runtime.list({ query: 'cats' })).toHaveLength(1);
      expect(runtime.list({ query: 'nope' })).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('removes by id and clears by target', () => {
    const { runtime, dir } = makeRuntime();
    try {
      const first = runtime.add({ targetType: 'user', targetId: 'u1', text: 'a' });
      runtime.add({ targetType: 'user', targetId: 'u1', text: 'b' });

      expect(runtime.remove(first.id)).toBe(true);
      expect(runtime.remove(first.id)).toBe(false);
      expect(runtime.list()).toHaveLength(1);

      expect(runtime.clear('user', 'u1')).toBe(1);
      expect(runtime.list()).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('persists across instances and loads empty on a missing file', () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.add({ targetType: 'guild', targetId: 'g1', text: 'hello' });
      const reloaded = new NoteRuntime(join(dir, 'notes.json'));
      expect(reloaded.list()).toHaveLength(1);

      const empty = new NoteRuntime(join(dir, 'missing.json'));
      expect(empty.list()).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
