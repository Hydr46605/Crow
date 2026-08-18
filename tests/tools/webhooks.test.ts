import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  createWebhook,
  deleteWebhook,
  executeWebhook,
  executeWebhookInput,
  getWebhook,
  listWebhooks,
  modifyWebhook,
  summarizeWebhook,
} from '../../src/tools/webhooks.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawWebhook = { id: 'w1', type: 1, channel_id: 'c1', name: 'hook', token: 's3cr3t' };

describe('summarizeWebhook', () => {
  it('maps a raw webhook to a summary including the token', () => {
    expect(summarizeWebhook(rawWebhook)).toEqual({
      id: 'w1',
      name: 'hook',
      type: 1,
      guildId: undefined,
      channelId: 'c1',
      avatar: undefined,
      token: 's3cr3t',
    });
  });
});

describe('listWebhooks', () => {
  it('requests the channel webhooks route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [rawWebhook];
    });

    const result = await listWebhooks({ channelId: 'c1' }, createContext(discord));

    expect(captured?.r).toBe('/channels/c1/webhooks');
    expect(textOf(result)).toContain('s3cr3t');
  });
});

describe('getWebhook', () => {
  it('requests the single webhook route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawWebhook;
    });

    await getWebhook({ webhookId: 'w1' }, createContext(discord));

    expect(captured?.r).toBe('/webhooks/w1');
  });
});

describe('createWebhook', () => {
  it('posts the webhook name', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawWebhook;
    });

    await createWebhook({ channelId: 'c1', name: 'new-hook' }, createContext(discord));

    expect(captured?.m).toBe('POST');
    expect(captured?.r).toBe('/channels/c1/webhooks');
    expect(captured?.o.body).toEqual({ name: 'new-hook' });
  });
});

describe('modifyWebhook', () => {
  it('patches the provided fields', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawWebhook;
    });

    await modifyWebhook({ webhookId: 'w1', name: 'renamed' }, createContext(discord));

    expect(captured?.m).toBe('PATCH');
    expect(captured?.r).toBe('/webhooks/w1');
    expect(captured?.o.body).toEqual({ name: 'renamed' });
  });
});

describe('deleteWebhook', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await deleteWebhook({ webhookId: 'w1' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('deletes with consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await deleteWebhook({ webhookId: 'w1', confirm: true }, createContext(discord));

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/webhooks/w1');
    expect(textOf(result)).toContain('Deleted webhook w1');
  });
});

describe('executeWebhook', () => {
  it('executes with the webhook token and message body', async () => {
    let capturedId: string | undefined;
    let capturedToken: string | undefined;
    let capturedOpts: { body?: unknown; query?: Record<string, unknown> } | undefined;

    const discord = new DiscordClient('token', undefined, async (id, token, opts) => {
      capturedId = id;
      capturedToken = token;
      capturedOpts = opts;
      return { id: 'm1' };
    });

    const result = await executeWebhook(
      { webhookId: 'w1', webhookToken: 'tok', content: 'hi', wait: true },
      createContext(discord),
    );

    expect(capturedId).toBe('w1');
    expect(capturedToken).toBe('tok');
    expect(capturedOpts?.body).toEqual({ content: 'hi' });
    expect(capturedOpts?.query).toEqual({ wait: true, thread_id: undefined });
    expect(textOf(result)).toContain('"id": "m1"');
  });

  it('maps username, avatar, embeds, and components into the body', async () => {
    let capturedOpts: { body?: Record<string, unknown> } | undefined;
    const discord = new DiscordClient('token', undefined, async (_id, _token, opts) => {
      capturedOpts = opts;
      return null;
    });

    await executeWebhook(
      {
        webhookId: 'w1',
        webhookToken: 'tok',
        content: 'hi',
        username: 'Bot',
        avatarUrl: 'https://a.example',
        embeds: [{ title: 'E' }],
        components: [
          {
            type: 'actionRow',
            components: [{ type: 'button', style: 'primary', customId: 'x', label: 'OK' }],
          },
        ],
      },
      createContext(discord),
    );

    const body = capturedOpts?.body;
    expect(body?.username).toBe('Bot');
    expect(body?.avatar_url).toBe('https://a.example');
    expect(body?.embeds).toEqual([{ title: 'E' }]);
    expect(body?.components).toEqual([
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'OK',
            custom_id: 'x',
            url: undefined,
            emoji: undefined,
            disabled: undefined,
          },
        ],
      },
    ]);
  });

  it('sends with_components and the V2 flag for layout components', async () => {
    let capturedOpts: { body?: Record<string, unknown>; query?: Record<string, unknown> } | undefined;
    const discord = new DiscordClient('token', undefined, async (_id, _token, opts) => {
      capturedOpts = opts;
      return null;
    });

    await executeWebhook(
      {
        webhookId: 'w1',
        webhookToken: 'tok',
        components: [{ type: 'textDisplay', content: 'V2 content' }],
      },
      createContext(discord),
    );

    expect(capturedOpts?.query).toEqual({ wait: undefined, thread_id: undefined, with_components: true });
    expect(capturedOpts?.body).toEqual({
      components: [{ type: 10, content: 'V2 content' }],
      flags: 32768,
    });
  });

  it('resolves attachments into files and body.attachments', async () => {
    let capturedOpts: { body?: Record<string, unknown>; files?: unknown[] } | undefined;
    const discord = new DiscordClient('token', undefined, async (_id, _token, opts) => {
      capturedOpts = opts;
      return null;
    });

    await executeWebhook(
      { webhookId: 'w1', webhookToken: 'tok', attachments: [{ name: 'a.txt', data: 'aGk=' }] },
      createContext(discord),
    );

    expect(capturedOpts?.body?.attachments).toEqual([{ id: 0, filename: 'a.txt', description: undefined }]);
    expect(capturedOpts?.files).toEqual([{ name: 'a.txt', data: Buffer.from('hi'), contentType: 'text/plain' }]);
  });
});

describe('executeWebhookInput', () => {
  it('rejects a body with no content, embeds, or components', () => {
    expect(executeWebhookInput.safeParse({ webhookId: 'w1', webhookToken: 'tok' }).success).toBe(false);
  });
});
