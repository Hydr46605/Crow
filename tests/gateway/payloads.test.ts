import { describe, expect, it } from 'vitest';
import {
  OPCODES,
  heartbeatPayload,
  identifyPayload,
  parseInteraction,
  parseMessage,
  readHeartbeatInterval,
  resumePayload,
} from '../../src/gateway/payloads.js';

describe('parseMessage', () => {
  it('parses a valid gateway frame', () => {
    expect(parseMessage(JSON.stringify({ op: 10, d: { heartbeat_interval: 41250 } }))).toEqual({
      op: 10,
      d: { heartbeat_interval: 41250 },
    });
  });

  it('returns null for invalid JSON or an invalid shape', () => {
    expect(parseMessage('not json')).toBeNull();
    expect(parseMessage(JSON.stringify({ op: 'ten' }))).toBeNull();
  });
});

describe('readHeartbeatInterval', () => {
  it('reads the interval from a HELLO message', () => {
    expect(readHeartbeatInterval({ op: OPCODES.HELLO, d: { heartbeat_interval: 30000 } })).toBe(30000);
  });

  it('returns null for a malformed HELLO', () => {
    expect(readHeartbeatInterval({ op: OPCODES.HELLO, d: {} })).toBeNull();
    expect(readHeartbeatInterval({ op: OPCODES.DISPATCH })).toBeNull();
  });
});

describe('parseInteraction', () => {
  it('extracts a component interaction with a custom_id', () => {
    expect(
      parseInteraction({ id: '1', type: 3, token: 'tok', data: { custom_id: 'hello' } }),
    ).toEqual({ id: '1', type: 3, token: 'tok', data: { custom_id: 'hello' } });
  });

  it('omits data when there is no custom_id', () => {
    expect(parseInteraction({ id: '1', type: 3, token: 'tok' })).toEqual({
      id: '1',
      type: 3,
      token: 'tok',
    });
  });

  it('returns null when required fields are missing', () => {
    expect(parseInteraction(null)).toBeNull();
    expect(parseInteraction({ type: 3, token: 'tok' })).toBeNull();
    expect(parseInteraction({ id: '1', token: 'tok' })).toBeNull();
    expect(parseInteraction({ id: '1', type: 3 })).toBeNull();
  });

  it('extracts values, inputs, user, and channel', () => {
    expect(
      parseInteraction({
        id: '1',
        type: 3,
        token: 'tok',
        channel_id: 'ch1',
        user: { id: 'u1' },
        data: {
          custom_id: 'pick',
          values: ['a', 'b'],
          components: [{ components: [{ custom_id: 'name', value: 'Alice' }] }],
        },
      }),
    ).toEqual({
      id: '1',
      type: 3,
      token: 'tok',
      channelId: 'ch1',
      userId: 'u1',
      data: {
        custom_id: 'pick',
        values: ['a', 'b'],
        components: [{ components: [{ custom_id: 'name', value: 'Alice' }] }],
      },
    });
  });

  it('reads the user id from the member object when there is no top-level user', () => {
    expect(
      parseInteraction({ id: '1', type: 3, token: 'tok', member: { user: { id: 'u2' } }, data: { custom_id: 'x' } })
        ?.userId,
    ).toBe('u2');
  });
});

describe('payload builders', () => {
  it('builds an identify payload with the token and intents', () => {
    expect(JSON.parse(identifyPayload('tok', 1 << 0))).toEqual({
      op: 2,
      d: {
        token: 'tok',
        intents: 1,
        properties: { os: expect.any(String), browser: 'crow', device: 'crow' },
      },
    });
  });

  it('builds a resume payload', () => {
    expect(JSON.parse(resumePayload('tok', 'session-1', 42))).toEqual({
      op: 6,
      d: { token: 'tok', session_id: 'session-1', seq: 42 },
    });
  });

  it('builds a heartbeat payload', () => {
    expect(JSON.parse(heartbeatPayload(7))).toEqual({ op: 1, d: 7 });
    expect(JSON.parse(heartbeatPayload(null))).toEqual({ op: 1, d: null });
  });
});
