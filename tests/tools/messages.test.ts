import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  bulkDeleteMessages,
  deleteMessage,
  editMessage,
  pinMessage,
  readMessages,
  sendMessage,
  summarizeMessage,
  unpinMessage,
} from '../../src/tools/messages.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawMessage = {
  id: '1',
  channel_id: '123456789012345678',
  author: { id: '999', username: 'hydra' },
  content: 'hello',
  timestamp: '2026-08-16T00:00:00.000Z',
};

describe('summarizeMessage', () => {
  it('maps a raw message to a compact summary', () => {
    expect(summarizeMessage(rawMessage)).toEqual({
      id: '1',
      channelId: '123456789012345678',
      authorId: '999',
      authorUsername: 'hydra',
      content: 'hello',
      createdAt: '2026-08-16T00:00:00.000Z',
    });
  });
});

describe('readMessages', () => {
  it('requests the channel messages route and returns summaries', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return [rawMessage];
    });

    const result = await readMessages(
      { channelId: '123456789012345678', limit: 10 },
      createContext(discord),
    );

    expect(captured?.method).toBe('GET');
    expect(captured?.route).toBe('/channels/123456789012345678/messages');
    expect(captured?.options.query?.limit).toBe(10);
    expect(textOf(result)).toContain('"authorUsername": "hydra"');
  });
});

describe('sendMessage', () => {
  it('posts content with a reply reference when given', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return rawMessage;
    });

    await sendMessage(
      { channelId: '123456789012345678', content: 'hi', replyTo: '555' },
      createContext(discord),
    );

    expect(captured?.method).toBe('POST');
    expect(captured?.route).toBe('/channels/123456789012345678/messages');
    expect(captured?.options.body).toEqual({ content: 'hi', message_reference: { message_id: '555' } });
  });

  it('omits the reply reference when not given', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return rawMessage;
    });

    await sendMessage({ channelId: '123456789012345678', content: 'hi' }, createContext(discord));

    expect(captured?.options.body).toEqual({ content: 'hi' });
  });
});

describe('editMessage', () => {
  it('patches the message content', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawMessage;
    });

    await editMessage(
      { channelId: '1', messageId: '9', content: 'updated' },
      createContext(discord),
    );

    expect(captured?.m).toBe('PATCH');
    expect(captured?.r).toBe('/channels/1/messages/9');
    expect(captured?.o.body).toEqual({ content: 'updated' });
  });
});

describe('deleteMessage', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await deleteMessage({ channelId: '1', messageId: '9' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('deletes with consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await deleteMessage(
      { channelId: '1', messageId: '9', confirm: true },
      createContext(discord),
    );

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/channels/1/messages/9');
    expect(textOf(result)).toContain('Deleted message 9');
  });
});

describe('sendMessage with embeds and components', () => {
  it('includes embeds, components, mentions, and tts in the body', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawMessage;
    });

    await sendMessage(
      {
        channelId: '123456789012345678',
        embeds: [{ title: 'Hi', color: '#ff0000' }],
        components: [
          {
            type: 'actionRow',
            components: [{ type: 'button', style: 'primary', customId: 'b', label: 'Go' }],
          },
        ],
        allowedMentions: { parse: ['users'] },
        tts: true,
      },
      createContext(discord),
    );

    expect(captured?.o.body).toEqual({
      embeds: [{ title: 'Hi', color: 0xff0000 }],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: 'Go',
              custom_id: 'b',
              url: undefined,
              emoji: undefined,
              disabled: undefined,
            },
          ],
        },
      ],
      allowed_mentions: { parse: ['users'], roles: undefined, users: undefined, replied_user: undefined },
      tts: true,
    });
  });
});

describe('editMessage with embeds', () => {
  it('patches embeds and components', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawMessage;
    });

    await editMessage(
      {
        channelId: '1',
        messageId: '9',
        embeds: [{ title: 'New' }],
        components: [
          {
            type: 'actionRow',
            components: [{ type: 'button', style: 'danger', customId: 'del', label: 'Delete' }],
          },
        ],
      },
      createContext(discord),
    );

    expect(captured?.m).toBe('PATCH');
    expect(captured?.o.body).toEqual({
      embeds: [{ title: 'New' }],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 4,
              label: 'Delete',
              custom_id: 'del',
              url: undefined,
              emoji: undefined,
              disabled: undefined,
            },
          ],
        },
      ],
    });
  });
});

describe('sendMessage with attachments', () => {
  it('resolves attachments into files and body.attachments', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawMessage;
    });

    await sendMessage(
      {
        channelId: '123456789012345678',
        attachments: [{ name: 'a.png', data: 'aGVsbG8=', description: 'alt' }],
      },
      createContext(discord),
    );

    expect(captured?.o.body).toEqual({
      attachments: [{ id: 0, filename: 'a.png', description: 'alt' }],
    });
    expect(captured?.o.files).toEqual([
      { name: 'a.png', data: Buffer.from('hello'), contentType: 'image/png' },
    ]);
  });

  it('accepts an attachment-only message', async () => {
    const discord = new DiscordClient('token', async () => rawMessage);
    const result = await sendMessage(
      { channelId: '123456789012345678', attachments: [{ data: 'aGk=' }] },
      createContext(discord),
    );
    expect(result.isError).toBeUndefined();
  });
});

describe('pinMessage', () => {
  it('puts the pin route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await pinMessage({ channelId: 'c', messageId: 'm' }, createContext(discord));

    expect(captured?.m).toBe('PUT');
    expect(captured?.r).toBe('/channels/c/pins/m');
    expect(textOf(result)).toContain('Pinned');
  });
});

describe('unpinMessage', () => {
  it('deletes the pin route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    await unpinMessage({ channelId: 'c', messageId: 'm' }, createContext(discord));

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/channels/c/pins/m');
  });
});

describe('bulkDeleteMessages', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await bulkDeleteMessages(
      { channelId: 'c', messageIds: ['1', '2'] },
      createContext(discord),
    );
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('posts the bulk-delete body with consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await bulkDeleteMessages(
      { channelId: 'c', messageIds: ['1', '2'], confirm: true },
      createContext(discord),
    );

    expect(captured?.m).toBe('POST');
    expect(captured?.r).toBe('/channels/c/messages/bulk-delete');
    expect(captured?.o.body).toEqual({ messages: ['1', '2'] });
    expect(textOf(result)).toContain('Deleted 2 messages');
  });
});
