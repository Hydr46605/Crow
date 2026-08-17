import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  createChannel,
  createThread,
  deleteChannel,
  deleteChannelPermissions,
  editChannelPermissions,
  getChannel,
  listActiveThreads,
  listArchivedThreads,
  listChannels,
  modifyChannel,
  modifyThread,
  summarizeChannel,
  summarizeThread,
} from '../../src/tools/channels.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawChannel = {
  id: '1',
  name: 'general',
  type: 0,
  topic: 'chat',
  nsfw: false,
  position: 1,
  parent_id: '9',
  rate_limit_per_user: 5,
};

describe('summarizeChannel', () => {
  it('maps a raw channel to a compact summary', () => {
    expect(summarizeChannel(rawChannel)).toMatchObject({
      id: '1',
      name: 'general',
      type: 0,
      topic: 'chat',
      nsfw: false,
      position: 1,
      parentId: '9',
      slowmodeSeconds: 5,
    });
  });
});

describe('listChannels', () => {
  it('requests the guild channels route and returns summaries', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [rawChannel];
    });

    const result = await listChannels({ guildId: 'g' }, createContext(discord));

    expect(captured?.r).toBe('/guilds/g/channels');
    expect(textOf(result)).toContain('"name": "general"');
  });
});

describe('getChannel', () => {
  it('requests the single-channel route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await getChannel({ channelId: '1' }, createContext(discord));

    expect(captured?.r).toBe('/channels/1');
  });
});

describe('modifyChannel', () => {
  it('sends only the provided fields', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await modifyChannel(
      { channelId: '1', name: 'renamed', nsfw: true, slowmodeSeconds: 30 },
      createContext(discord),
    );

    expect(captured?.m).toBe('PATCH');
    expect(captured?.r).toBe('/channels/1');
    expect(captured?.o.body).toEqual({ name: 'renamed', nsfw: true, rate_limit_per_user: 30 });
  });
});

describe('createChannel', () => {
  it('maps the type code and sends the body', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await createChannel({ guildId: 'g', name: 'x', type: 'forum', topic: 't' }, createContext(discord));

    expect(captured?.m).toBe('POST');
    expect(captured?.r).toBe('/guilds/g/channels');
    expect(captured?.o.body).toEqual({ name: 'x', type: 15, topic: 't' });
  });

  it('defaults to a text channel', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await createChannel({ guildId: 'g', name: 'x' }, createContext(discord));

    expect(captured?.o.body).toEqual({ name: 'x', type: 0 });
  });
});

describe('deleteChannel', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await deleteChannel({ channelId: '1' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('deletes with consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await deleteChannel({ channelId: '1', confirm: true }, createContext(discord));

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/channels/1');
    expect(textOf(result)).toContain('Deleted channel 1');
  });
});

describe('summarizeChannel (extended)', () => {
  it('maps type names and permission overwrites', () => {
    const summary = summarizeChannel({
      ...rawChannel,
      type: 0,
      permission_overwrites: [
        { id: 'r1', type: 0, allow: (1n << 10n | 1n << 11n).toString(), deny: '0' },
      ],
    });

    expect(summary.typeName).toBe('text');
    expect(summary.permissionOverwrites).toEqual([
      { id: 'r1', type: 'role', allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'], deny: [] },
    ]);
  });
});

describe('modifyChannel (voice, forum, overwrites)', () => {
  it('maps voice and forum fields and overwrites', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await modifyChannel(
      {
        channelId: '1',
        bitrate: 64000,
        userLimit: 10,
        videoQualityMode: 'full',
        defaultAutoArchiveDuration: 1440,
        defaultThreadRateLimitPerUser: 30,
        availableTags: [{ name: 'help' }],
        defaultReactionEmoji: { emojiName: '👍' },
        defaultSortOrder: 'creationDate',
        defaultForumLayout: 'listView',
        permissionOverwrites: [{ id: 'r1', type: 'role', allow: ['VIEW_CHANNEL'], deny: ['SEND_MESSAGES'] }],
      },
      createContext(discord),
    );

    expect(captured?.o.body).toEqual({
      bitrate: 64000,
      user_limit: 10,
      video_quality_mode: 2,
      default_auto_archive_duration: 1440,
      default_thread_rate_limit_per_user: 30,
      available_tags: [{ name: 'help', emoji_id: undefined, emoji_name: undefined, moderated: undefined }],
      default_reaction_emoji: { emoji_id: undefined, emoji_name: '👍' },
      default_sort_order: 1,
      default_forum_layout: 1,
      permission_overwrites: [
        {
          id: 'r1',
          type: 0,
          allow: (1n << 10n).toString(),
          deny: (1n << 11n).toString(),
        },
      ],
    });
  });
});

describe('listActiveThreads', () => {
  it('requests the guild active-threads route and returns thread summaries', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return {
        threads: [{ ...rawChannel, id: 't1', type: 11, thread_metadata: { archived: false } }],
        members: [],
      };
    });

    const result = await listActiveThreads({ guildId: 'g' }, createContext(discord));

    expect(captured?.r).toBe('/guilds/g/threads/active');
    expect(textOf(result)).toContain('"id": "t1"');
  });

  it('filters threads to a single channel by parent id', async () => {
    const discord = new DiscordClient('token', async () => ({
      threads: [
        { id: 't1', name: 'a', type: 11, parent_id: '1' },
        { id: 't2', name: 'b', type: 11, parent_id: '2' },
      ],
      members: [],
    }));

    const result = await listActiveThreads({ guildId: 'g', channelId: '2' }, createContext(discord));
    const text = textOf(result);

    expect(text).toContain('"id": "t2"');
    expect(text).not.toContain('"id": "t1"');
  });
});

describe('summarizeThread', () => {
  it('maps thread fields and metadata', () => {
    const summary = summarizeThread({
      id: 't1',
      name: 'post',
      type: 11,
      parent_id: '1',
      owner_id: '9',
      message_count: 3,
      member_count: 2,
      total_message_sent: 4,
      applied_tags: ['tag1'],
      thread_metadata: {
        archived: false,
        locked: false,
        auto_archive_duration: 1440,
        archive_timestamp: '2026-08-16T00:00:00.000Z',
        create_timestamp: '2026-08-15T00:00:00.000Z',
      },
    });

    expect(summary).toMatchObject({
      id: 't1',
      name: 'post',
      typeName: 'publicThread',
      parentId: '1',
      ownerId: '9',
      messageCount: 3,
      memberCount: 2,
      totalMessageSent: 4,
      appliedTags: ['tag1'],
      archived: false,
      locked: false,
      autoArchiveDuration: 1440,
      archiveTimestamp: '2026-08-16T00:00:00.000Z',
      createTimestamp: '2026-08-15T00:00:00.000Z',
    });
  });
});

describe('createThread', () => {
  it('creates a channel thread with the public type by default', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await createThread({ channelId: '1', name: 'thread', rateLimitPerUser: 5 }, createContext(discord));

    expect(captured?.r).toBe('/channels/1/threads');
    expect(captured?.o.body).toEqual({ name: 'thread', type: 11, rate_limit_per_user: 5 });
  });

  it('starts a thread from a message', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await createThread(
      { channelId: '1', messageId: '9', name: 'thread', autoArchiveDuration: 60 },
      createContext(discord),
    );

    expect(captured?.r).toBe('/channels/1/messages/9/threads');
    expect(captured?.o.body).toEqual({ name: 'thread', auto_archive_duration: 60 });
  });

  it('creates a forum post with initial content and tags', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await createThread(
      {
        channelId: '1',
        name: 'post',
        message: { content: 'hello', embeds: [{ title: 'T' }] },
        appliedTags: ['t1'],
      },
      createContext(discord),
    );

    expect(captured?.r).toBe('/channels/1/threads');
    expect(captured?.o.body).toEqual({
      name: 'post',
      type: 11,
      message: { content: 'hello', embeds: [{ title: 'T' }] },
      applied_tags: ['t1'],
    });
  });
});

describe('listArchivedThreads', () => {
  it('requests the archived-public-threads route with pagination', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { threads: [{ ...rawChannel, id: 't1', type: 11 }], members: [], has_more: false };
    });

    const result = await listArchivedThreads(
      { channelId: '1', before: '2026-08-16T00:00:00.000Z', limit: 25 },
      createContext(discord),
    );

    expect(captured?.r).toBe('/channels/1/threads/archived/public');
    expect(captured?.o.query?.before).toBe('2026-08-16T00:00:00.000Z');
    expect(captured?.o.query?.limit).toBe(25);
    expect(textOf(result)).toContain('"hasMore": false');
  });
});

describe('modifyThread', () => {
  it('patches the thread fields', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await modifyThread({ threadId: 't1', archived: true, locked: true }, createContext(discord));

    expect(captured?.r).toBe('/channels/t1');
    expect(captured?.o.body).toEqual({ archived: true, locked: true });
  });
});

describe('editChannelPermissions', () => {
  it('puts a permission overwrite with named permissions', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await editChannelPermissions(
      { channelId: '1', overwriteId: 'r1', type: 'role', allow: ['VIEW_CHANNEL'], deny: ['SEND_MESSAGES'] },
      createContext(discord),
    );

    expect(captured?.r).toBe('/channels/1/permissions/r1');
    expect(captured?.o.body).toEqual({
      type: '0',
      allow: (1n << 10n).toString(),
      deny: (1n << 11n).toString(),
    });
    expect(textOf(result)).toContain('role r1');
  });
});

describe('deleteChannelPermissions', () => {
  it('deletes a permission overwrite', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await deleteChannelPermissions(
      { channelId: '1', overwriteId: 'r1' },
      createContext(discord),
    );

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/channels/1/permissions/r1');
    expect(textOf(result)).toContain('overwrite r1');
  });
});
