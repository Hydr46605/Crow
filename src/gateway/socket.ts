/** A gateway socket event, discriminated by type. */
export type GatewaySocketEvent =
  | { readonly type: 'open' }
  | { readonly type: 'message'; readonly data: string }
  | { readonly type: 'close'; readonly code: number; readonly reason: string }
  | { readonly type: 'error'; readonly error: unknown };

/**
 * Minimal WebSocket surface Crow's gateway needs, so the connection logic can
 * be tested with a fake socket instead of a live Discord connection.
 */
export interface GatewaySocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(handler: (event: GatewaySocketEvent) => void): void;
}

/** The subset of the platform WebSocket Crow's wrapper touches. */
interface NativeWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  onerror: (() => void) | null;
}

/** Wraps the platform WebSocket (native since Node 22) in a GatewaySocket. */
export const createNativeSocket = (url: string): GatewaySocket => {
  const socket = new WebSocket(url) as unknown as NativeWebSocket;
  return {
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
    on: (handler) => {
      socket.onopen = () => handler({ type: 'open' });
      socket.onmessage = (e) =>
        handler({ type: 'message', data: typeof e.data === 'string' ? e.data : String(e.data) });
      socket.onclose = (e) => handler({ type: 'close', code: e.code, reason: e.reason });
      socket.onerror = () => handler({ type: 'error', error: new Error('WebSocket error') });
    },
  };
};
