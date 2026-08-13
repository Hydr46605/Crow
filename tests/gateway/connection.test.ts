import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayConnection } from '../../src/gateway/connection.js';
import { OPCODES, type GatewayInteraction } from '../../src/gateway/payloads.js';
import type { GatewaySocket, GatewaySocketEvent } from '../../src/gateway/socket.js';

class FakeSocket implements GatewaySocket {
  sent: string[] = [];
  closeArgs: { code?: number; reason?: string }[] = [];
  private handler?: (event: GatewaySocketEvent) => void;

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeArgs.push({ code, reason });
    this.handler?.({ type: 'close', code: code ?? 1000, reason: reason ?? '' });
  }

  on(handler: (event: GatewaySocketEvent) => void): void {
    this.handler = handler;
  }

  emitOpen(): void {
    this.handler?.({ type: 'open' });
  }

  emitMessage(payload: unknown): void {
    this.handler?.({ type: 'message', data: JSON.stringify(payload) });
  }

  emitClose(code = 1006, reason = ''): void {
    this.handler?.({ type: 'close', code, reason });
  }
}

const hello = (interval = 1_000) => ({ op: OPCODES.HELLO, d: { heartbeat_interval: interval } });
const ready = (sessionId: string) => ({
  op: OPCODES.DISPATCH,
  t: 'READY',
  s: 1,
  d: { session_id: sessionId },
});

const makeConnection = (
  onInteraction?: (interaction: GatewayInteraction) => void,
): { connection: GatewayConnection; sockets: FakeSocket[] } => {
  const sockets: FakeSocket[] = [];
  const connection = new GatewayConnection({
    token: 'tok',
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    onInteraction,
  });
  connection.connect();
  return { connection, sockets };
};

describe('GatewayConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('identifies after receiving HELLO', () => {
    const { connection, sockets } = makeConnection();
    sockets[0].emitOpen();
    sockets[0].emitMessage(hello());

    const identify = sockets[0].sent.find((m) => JSON.parse(m).op === OPCODES.IDENTIFY);
    expect(identify).toBeDefined();
    expect(JSON.parse(identify!)).toEqual({
      op: 2,
      d: { token: 'tok', intents: 1, properties: { os: expect.any(String), browser: 'crow', device: 'crow' } },
    });
    connection.close();
  });

  it('resumes with the session id after reconnecting', () => {
    const { connection, sockets } = makeConnection();
    sockets[0].emitOpen();
    sockets[0].emitMessage(hello());
    sockets[0].emitMessage(ready('session-123'));
    sockets[0].emitClose(1001, 'server');

    vi.advanceTimersByTime(1_000);
    const second = sockets[1];
    second.emitOpen();
    second.emitMessage(hello());

    const resume = second.sent.find((m) => JSON.parse(m).op === OPCODES.RESUME);
    expect(resume).toBeDefined();
    expect(JSON.parse(resume!)).toEqual({ op: 6, d: { token: 'tok', session_id: 'session-123', seq: 1 } });
    connection.close();
  });

  it('heartbeats and closes the socket when not acknowledged', () => {
    const { connection, sockets } = makeConnection();
    sockets[0].emitOpen();
    sockets[0].emitMessage(hello(1_000));

    vi.advanceTimersByTime(1_000);
    expect(sockets[0].sent.some((m) => JSON.parse(m).op === OPCODES.HEARTBEAT)).toBe(true);

    sockets[0].emitMessage({ op: OPCODES.HEARTBEAT_ACK });
    vi.advanceTimersByTime(1_000);
    expect(sockets[0].closeArgs.length).toBe(0);

    vi.advanceTimersByTime(1_000);
    expect(sockets[0].closeArgs.length).toBeGreaterThan(0);
    connection.close();
  });

  it('dispatches INTERACTION_CREATE to the handler', () => {
    const interactions: GatewayInteraction[] = [];
    const { connection, sockets } = makeConnection((interaction) => interactions.push(interaction));

    sockets[0].emitOpen();
    sockets[0].emitMessage(hello());
    sockets[0].emitMessage({
      op: OPCODES.DISPATCH,
      t: 'INTERACTION_CREATE',
      s: 5,
      d: { id: '111', type: 3, token: 'itok', data: { custom_id: 'hello' } },
    });

    expect(interactions).toEqual([{ id: '111', type: 3, token: 'itok', data: { custom_id: 'hello' } }]);
    connection.close();
  });

  it('re-identifies after a non-resumable INVALID_SESSION', () => {
    const { connection, sockets } = makeConnection();
    sockets[0].emitOpen();
    sockets[0].emitMessage(hello());
    sockets[0].emitMessage(ready('session-123'));
    sockets[0].emitMessage({ op: OPCODES.INVALID_SESSION, d: false });

    vi.advanceTimersByTime(1_000);
    const second = sockets[1];
    second.emitOpen();
    second.emitMessage(hello());

    expect(second.sent.some((m) => JSON.parse(m).op === OPCODES.IDENTIFY)).toBe(true);
    connection.close();
  });

  it('doubles the reconnect backoff until READY resets it', () => {
    const { connection, sockets } = makeConnection();
    sockets[0].emitOpen();
    sockets[0].emitMessage(hello());

    sockets[0].emitClose(1006, '');
    vi.advanceTimersByTime(1_000);
    expect(sockets.length).toBe(2);

    sockets[1].emitOpen();
    sockets[1].emitMessage(hello());
    sockets[1].emitClose(1006, '');

    vi.advanceTimersByTime(1_000);
    expect(sockets.length).toBe(2);
    vi.advanceTimersByTime(1_000);
    expect(sockets.length).toBe(3);
    connection.close();
  });
});
