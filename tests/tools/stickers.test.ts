import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  createSticker,
  deleteSticker,
  getSticker,
  getStickerPack,
  listStickerPacks,
  listStickers,
  modifySticker,
  summarizeSticker,
} from '../../src/tools/stickers.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawSticker = {
  id: 's1',
  name: 'happy',
  description: 'A happy sticker',
  tags: 'happy,joy',
  type: 2,
  format_type: 1,
  available: true,
  guild_id: 'g1',
};

describe('summarizeSticker', () => {
  it('maps a raw sticker to a summary', () => {
    expect(summarizeSticker(rawSticker)).toEqual({
      id: 's1',
      name: 'happy',
      description: 'A happy sticker',
      tags: 'happy,joy',
      type: 'guild',
      formatType: 'png',
      available: true,
      guildId: 'g1',
    });
  });
});

describe('listStickers / getSticker', () => {
  it('requests the correct routes', async () => {
    const routes: string[] = [];
    const discord = new DiscordClient('token', async (m, r) => {
      routes.push(`${m} ${r}`);
      return m === 'GET' && r.endsWith('/stickers') ? [rawSticker] : rawSticker;
    });
    await listStickers({ guildId: 'g1' }, createContext(discord));
    await getSticker({ guildId: 'g1', stickerId: 's1' }, createContext(discord));
    expect(routes).toEqual(['GET /guilds/g1/stickers', 'GET /guilds/g1/stickers/s1']);
  });
});

describe('sticker packs', () => {
  it('lists and gets sticker packs', async () => {
    const routes: string[] = [];
    const discord = new DiscordClient('token', async (m, r) => {
      routes.push(`${m} ${r}`);
      return m === 'GET' && r === '/sticker-packs'
        ? { sticker_packs: [{ id: 'p1', name: 'Pack', description: 'd', stickers: [rawSticker] }] }
        : { sticker_pack: { id: 'p1', name: 'Pack', description: 'd', stickers: [rawSticker] } };
    });
    await listStickerPacks(createContext(discord));
    await getStickerPack({ packId: 'p1' }, createContext(discord));
    expect(routes).toEqual(['GET /sticker-packs', 'GET /sticker-packs/p1']);
  });
});

describe('createSticker', () => {
  it('uploads the file as the multipart file field', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, options: o };
      return rawSticker;
    });
    await createSticker(
      { guildId: 'g1', name: 'happy', tags: 'happy', file: { name: 'x.png', data: 'aGVsbG8=' } },
      createContext(discord),
    );
    expect(captured?.r).toBe('/guilds/g1/stickers');
    expect(captured?.options.body).toEqual({ name: 'happy', description: undefined, tags: 'happy' });
    expect(captured?.options.appendToFormData).toBe(true);
    expect(captured?.options.files?.[0]).toMatchObject({ name: 'x.png', key: 'file' });
  });
});

describe('modifySticker', () => {
  it('patches only the provided fields', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, options: o };
      return rawSticker;
    });
    await modifySticker({ guildId: 'g1', stickerId: 's1', name: 'renamed' }, createContext(discord));
    expect(captured?.r).toBe('/guilds/g1/stickers/s1');
    expect(captured?.options.body).toEqual({ name: 'renamed' });
  });
});

describe('deleteSticker', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await deleteSticker({ guildId: 'g1', stickerId: 's1' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('deletes with consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r) => {
      captured = { m, r, options: {} };
      return null;
    });
    const result = await deleteSticker({ guildId: 'g1', stickerId: 's1', confirm: true }, createContext(discord));
    expect(captured?.r).toBe('/guilds/g1/stickers/s1');
    expect(textOf(result)).toContain('Deleted sticker s1');
  });
});
