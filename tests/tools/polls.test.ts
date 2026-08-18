import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  endPoll,
  getPollAnswerVoters,
  normalizePoll,
  pollSchema,
  summarizePoll,
} from '../../src/tools/polls.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

describe('normalizePoll', () => {
  it('maps friendly poll input to the create-request object', () => {
    expect(
      normalizePoll({
        question: 'Q?',
        answers: [{ text: 'Yes', emojiName: '👍' }, { text: 'No' }],
        durationHours: 48,
        allowMultiselect: true,
      }),
    ).toEqual({
      question: { text: 'Q?' },
      answers: [
        { poll_media: { text: 'Yes', emoji: { name: '👍' } } },
        { poll_media: { text: 'No', emoji: undefined } },
      ],
      duration: 48,
      allow_multiselect: true,
    });
  });

  it('rejects fewer than two answers', () => {
    expect(pollSchema.safeParse({ question: 'Q?', answers: [{ text: 'Only' }] }).success).toBe(false);
  });
});

describe('summarizePoll', () => {
  it('decodes a raw poll with results', () => {
    expect(
      summarizePoll({
        question: { text: 'Q?' },
        answers: [{ answer_id: 1, poll_media: { text: 'Yes', emoji: { name: '👍', id: null } } }],
        expiry: '2026-08-19T00:00:00Z',
        allow_multiselect: false,
        layout_type: 1,
        results: { is_finalized: true, answer_counts: [{ id: 1, count: 3, me_voted: true }] },
      }),
    ).toEqual({
      question: 'Q?',
      answers: [{ answerId: 1, text: 'Yes', emojiId: null, emojiName: '👍' }],
      expiry: '2026-08-19T00:00:00Z',
      allowMultiselect: false,
      layoutType: 1,
      results: { isFinalized: true, answerCounts: [{ answerId: 1, count: 3, meVoted: true }] },
    });
  });
});

describe('getPollAnswerVoters', () => {
  it('requests the voters route and summarizes users', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { users: [{ id: 'u1', username: 'alice', discriminator: '0' }] };
    });

    const result = await getPollAnswerVoters(
      { channelId: 'c', messageId: 'm', answerId: 2, limit: 10 },
      createContext(discord),
    );

    expect(captured?.r).toBe('/channels/c/polls/m/answers/2');
    expect(captured?.o.query?.limit).toBe(10);
    expect(textOf(result)).toContain('alice');
  });
});

describe('endPoll', () => {
  it('posts the expire route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { id: 'm1' };
    });

    await endPoll({ channelId: 'c', messageId: 'm' }, createContext(discord));

    expect(captured?.m).toBe('POST');
    expect(captured?.r).toBe('/channels/c/polls/m/expire');
  });
});
