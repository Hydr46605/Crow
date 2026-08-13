import {
  GATEWAY_INTENTS,
  GATEWAY_URL,
  OPCODES,
  heartbeatPayload,
  identifyPayload,
  parseInteraction,
  parseMessage,
  readHeartbeatInterval,
  resumePayload,
  type GatewayInteraction,
  type GatewayMessage,
} from './payloads.js';
import { createNativeSocket, type GatewaySocket } from './socket.js';

export type GatewaySocketFactory = (url: string) => GatewaySocket;

export type GatewayState = 'connecting' | 'ready' | 'resuming' | 'closed';

export interface GatewayConnectionOptions {
  readonly token: string;
  readonly intents?: number;
  readonly socketFactory?: GatewaySocketFactory;
  readonly onInteraction?: (interaction: GatewayInteraction) => void | Promise<void>;
  readonly onLog?: (message: string) => void;
  readonly onStateChange?: (state: GatewayState) => void;
}

const DEFAULT_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * A Discord Gateway connection: connect, identify (or resume), heartbeat with
 * ack tracking, and reconnect with exponential backoff. Interactions are
 * delivered to `onInteraction`.
 *
 * The protocol state lives here; transport concerns (sending callbacks) stay
 * in `transport.ts`, so this class is testable against a fake socket.
 */
export class GatewayConnection {
  private socket?: GatewaySocket;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeatInterval = 41_250;
  private sessionId?: string;
  private sequence: number | null = null;
  private acked = true;
  private backoffMs = DEFAULT_BACKOFF_MS;
  private state: GatewayState = 'connecting';
  private stopped = false;

  constructor(private readonly options: GatewayConnectionOptions) {}

  /** The current connection state. */
  get currentState(): GatewayState {
    return this.state;
  }

  /** Opens the connection and starts the gateway loop. */
  connect(): void {
    this.stopped = false;
    this.setState('connecting');
    this.open();
  }

  /** Gracefully closes the connection and stops all timers. */
  close(): void {
    this.stopped = true;
    this.stopHeartbeat();
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.socket?.close(1000, 'shutdown');
    this.socket = undefined;
    this.setState('closed');
  }

  private open(): void {
    const factory = this.options.socketFactory ?? createNativeSocket;
    const socket = factory(GATEWAY_URL);
    this.socket = socket;

    socket.on((event) => {
      switch (event.type) {
        case 'open':
          this.log('gateway: socket open');
          return;
        case 'message':
          this.handleMessage(event.data);
          return;
        case 'close':
          this.handleClose(event.code, event.reason);
          return;
        case 'error':
          this.log(
            `gateway: socket error: ${event.error instanceof Error ? event.error.message : String(event.error)}`,
          );
          return;
        default:
          return;
      }
    });
  }

  private handleMessage(raw: string): void {
    const message = parseMessage(raw);
    if (!message) {
      this.log('gateway: ignoring unparseable message');
      return;
    }
    if (message.s !== null && message.s !== undefined) this.sequence = message.s;

    switch (message.op) {
      case OPCODES.HELLO:
        this.handleHello(message);
        return;
      case OPCODES.HEARTBEAT_ACK:
        this.acked = true;
        return;
      case OPCODES.RECONNECT:
        this.log('gateway: reconnect requested, resuming');
        this.reconnect();
        return;
      case OPCODES.INVALID_SESSION:
        this.handleInvalidSession(message);
        return;
      case OPCODES.DISPATCH:
        this.handleDispatch(message);
        return;
      default:
        return;
    }
  }

  private handleHello(message: GatewayMessage): void {
    const interval = readHeartbeatInterval(message);
    if (interval === null) {
      this.log('gateway: invalid HELLO payload');
      return;
    }
    this.heartbeatInterval = interval;
    this.startHeartbeat();
    if (this.sessionId) {
      this.resume();
    } else {
      this.identify();
    }
  }

  private handleInvalidSession(message: GatewayMessage): void {
    const resumable = message.d === true;
    this.log(resumable ? 'gateway: session invalid but resumable' : 'gateway: session invalid, re-identifying');
    if (!resumable) {
      this.sessionId = undefined;
      this.sequence = null;
    }
    this.reconnect();
  }

  private handleDispatch(message: GatewayMessage): void {
    switch (message.t) {
      case 'READY': {
        const ready = message.d as { session_id?: unknown } | undefined;
        if (ready && typeof ready.session_id === 'string') this.sessionId = ready.session_id;
        this.backoffMs = DEFAULT_BACKOFF_MS;
        this.setState('ready');
        this.log('gateway: ready');
        return;
      }
      case 'RESUMED':
        this.setState('ready');
        this.log('gateway: resumed');
        return;
      case 'INTERACTION_CREATE': {
        const interaction = parseInteraction(message.d);
        if (!interaction) {
          this.log('gateway: unparseable interaction');
          return;
        }
        void this.dispatchInteraction(interaction);
        return;
      }
      default:
        return;
    }
  }

  private async dispatchInteraction(interaction: GatewayInteraction): Promise<void> {
    try {
      await this.options.onInteraction?.(interaction);
    } catch (error) {
      this.log(`gateway: interaction handler failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private handleClose(code: number, reason: string): void {
    this.stopHeartbeat();
    this.socket = undefined;
    if (this.stopped) {
      this.setState('closed');
      return;
    }
    this.log(`gateway: socket closed (${code}) ${reason}; reconnecting`);
    this.scheduleReconnect();
  }

  private reconnect(): void {
    this.stopHeartbeat();
    this.socket?.close(4000, 'reconnect');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== undefined) return;
    this.setState(this.sessionId ? 'resuming' : 'connecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.open();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }

  private identify(): void {
    this.socket?.send(identifyPayload(this.options.token, this.options.intents ?? GATEWAY_INTENTS));
  }

  private resume(): void {
    if (this.sessionId) {
      this.socket?.send(resumePayload(this.options.token, this.sessionId, this.sequence));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.acked = true;
    this.heartbeatTimer = setInterval(() => {
      if (!this.acked) {
        this.log('gateway: heartbeat not acked, reconnecting');
        this.socket?.close();
        return;
      }
      this.acked = false;
      this.socket?.send(heartbeatPayload(this.sequence));
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== undefined) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private setState(state: GatewayState): void {
    this.state = state;
    this.options.onStateChange?.(state);
  }

  private log(message: string): void {
    this.options.onLog?.(message);
  }
}
