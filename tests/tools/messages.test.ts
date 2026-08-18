import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  buildMessageBody,
  bulkDeleteMessages,
  deleteMessage,
  editMessage,
  pinMessage,
  readMessages,
  readMessagesInput,
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
    expect(summarizeMessage(rawMessage)).toMatchObject({
      id: '1',
      channelId: '123456789012345678',
      authorId: '999',
      authorUsername: 'hydra',
      content: 'hello',
      createdAt: '2026-08-16T00:00:00.000Z',
    });
  });

  it('includes embeds, components, attachments, stickers, and reactions', () => {
    const summary = summarizeMessage({
      ...rawMessage,
      content: '',
      type: 8,
      flags: 128,
      pinned: true,
      tts: false,
      edited_timestamp: '2026-08-16T01:00:00.000Z',
      embeds: [
        { type: 'rich', title: 'T', description: 'D', fields: [{ name: 'K', value: 'V', inline: true }] },
      ],
      components: [{ type: 1, components: [{ type: 2, custom_id: 'b', label: 'Go' }] }],
      attachments: [
        {
          id: 'a1',
          filename: 'pic.png',
          size: 10,
          url: 'https://cdn/u',
          proxy_url: 'https://cdn/p',
          content_type: 'image/png',
        },
      ],
      sticker_items: [{ id: 's1', name: 'sticker', format_type: 1 }],
      reactions: [{ count: 2, me: true, emoji: { name: '👍' } }],
      mention_everyone: false,
      mention_roles: ['r1'],
    });

    expect(summary.embeds).toEqual([
      { type: 'rich', title: 'T', description: 'D', fields: [{ name: 'K', value: 'V', inline: true }] },
    ]);
    expect(summary.components).toEqual([
      {
        type: 'actionRow',
        components: [
          { type: 'button', style: null, label: 'Go', customId: 'b', url: null, emoji: undefined, disabled: false },
        ],
      },
    ]);
    expect(summary.attachments).toEqual([
      {
        id: 'a1',
        filename: 'pic.png',
        description: null,
        contentType: 'image/png',
        size: 10,
        url: 'https://cdn/u',
        proxyUrl: 'https://cdn/p',
        width: null,
        height: null,
        ephemeral: false,
      },
    ]);
    expect(summary.stickerItems).toEqual([{ id: 's1', name: 'sticker', formatType: 1 }]);
    expect(summary.reactions).toEqual([{ count: 2, me: true, emoji: { id: null, name: '👍' } }]);
    expect(summary.editedAt).toBe('2026-08-16T01:00:00.000Z');
    expect(summary.pinned).toBe(true);
    expect(summary.mentionRoles).toEqual(['r1']);
  });

  it('recursively summarizes a referenced message', () => {
    const summary = summarizeMessage({
      ...rawMessage,
      referenced_message: { ...rawMessage, id: '2', content: 'reply target' },
    });
    expect(summary.referencedMessage).toEqual(
      expect.objectContaining({ id: '2', content: 'reply target' }),
    );
  });

  it('decodes a poll', () => {
    const summary = summarizeMessage({
      ...rawMessage,
      poll: {
        question: { text: 'Q?' },
        answers: [{ answer_id: 1, poll_media: { text: 'Yes', emoji: { name: '👍', id: null } } }],
        results: { is_finalized: true, answer_counts: [{ id: 1, count: 3, me_voted: true }] },
      },
    });

    expect(summary.poll).toEqual({
      question: 'Q?',
      answers: [{ answerId: 1, text: 'Yes', emojiId: null, emojiName: '👍' }],
      expiry: undefined,
      allowMultiselect: undefined,
      layoutType: undefined,
      results: { isFinalized: true, answerCounts: [{ answerId: 1, count: 3, meVoted: true }] },
    });
  });
});

describe('buildMessageBody', () => {
  it('builds the body and resolves attachments from the shared fields', async () => {
    const { body, files } = await buildMessageBody({
      content: 'hi',
      embeds: [{ title: 'T' }],
      attachments: [{ name: 'a.txt', data: 'aGVsbG8=' }],
    });

    expect(body).toEqual({
      content: 'hi',
      embeds: [{ title: 'T' }],
      attachments: [{ id: 0, filename: 'a.txt', description: undefined }],
    });
    expect(files).toEqual([{ name: 'a.txt', data: Buffer.from('hello'), contentType: 'text/plain' }]);
  });
});

describe('buildMessageBody file-reference validation', () => {
  it('rejects a component referencing an attachment that is not provided', async () => {
    await expect(
      buildMessageBody({
        components: [{ type: 'file', file: { url: 'attachment://missing.pdf' } }],
        attachments: [{ name: 'other.txt', data: 'aGk=' }],
      }),
    ).rejects.toThrow('no attachment is named "missing.pdf"');
  });

  it('accepts a component referencing a provided attachment', async () => {
    const { body } = await buildMessageBody({
      components: [{ type: 'file', file: { url: 'attachment://f.txt' } }],
      attachments: [{ name: 'f.txt', data: 'aGk=' }],
    });

    expect(body.components).toEqual([{ type: 13, file: { url: 'attachment://f.txt' }, spoiler: undefined }]);
  });
});

describe('buildMessageBody with components V2', () => {
  it('sets the Components V2 flag when layout components are used', async () => {
    const { body } = await buildMessageBody({
      components: [
        { type: 'textDisplay', content: 'Hello **world**' },
        { type: 'container', components: [{ type: 'textDisplay', content: 'inner' }] },
      ],
    });

    expect(body.flags).toBe(32768);
    expect(body.components).toEqual([
      { type: 10, content: 'Hello **world**' },
      { type: 17, accent_color: undefined, spoiler: undefined, components: [{ type: 10, content: 'inner' }] },
    ]);
  });

  it('does not set the flag for V1 components', async () => {
    const { body } = await buildMessageBody({
      components: [
        { type: 'actionRow', components: [{ type: 'button', style: 'primary', customId: 'b', label: 'Go' }] },
      ],
    });

    expect(body.flags).toBeUndefined();
  });
});

describe('readMessagesInput', () => {
  it('rejects multiple pagination anchors', () => {
    expect(
      readMessagesInput.safeParse({
        channelId: '123456789012345678',
        before: '111111111111111111',
        after: '222222222222222222',
      }).success,
    ).toBe(false);
    expect(
      readMessagesInput.safeParse({
        channelId: '123456789012345678',
        before: '111111111111111111',
        around: '222222222222222222',
      }).success,
    ).toBe(false);
  });

  it('accepts a single anchor', () => {
    expect(
      readMessagesInput.safeParse({ channelId: '123456789012345678', before: '111111111111111111' }).success,
    ).toBe(true);
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

describe('sendMessage with poll', () => {
  it('includes the poll in the body', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawMessage;
    });

    await sendMessage(
      { channelId: '123456789012345678', poll: { question: 'Q?', answers: [{ text: 'Yes' }, { text: 'No' }] } },
      createContext(discord),
    );

    expect(captured?.o.body.poll).toEqual({
      question: { text: 'Q?' },
      answers: [
        { poll_media: { text: 'Yes', emoji: undefined } },
        { poll_media: { text: 'No', emoji: undefined } },
      ],
      duration: undefined,
      allow_multiselect: undefined,
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
