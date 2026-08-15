import { z } from 'zod';

/** Discord Gateway API version Crow speaks. */
export const GATEWAY_VERSION = 10;

/** Gateway base URL. Compression is disabled so payloads stay plain JSON. */
export const GATEWAY_URL = `wss://gateway.discord.gg/?v=${GATEWAY_VERSION}&encoding=json`;

/** Gateway intents Crow requests. `GUILDS` is enough to receive interactions. */
export const GATEWAY_INTENTS = 1 << 0;

/** Gateway opcodes Crow implements. */
export const OPCODES = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  RESUME: 6,
  RECONNECT: 7,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
} as const;

/** The only field Crow reads from the HELLO payload. */
const helloSchema = z.object({
  d: z.object({ heartbeat_interval: z.number().int().positive() }),
});

/** A raw gateway message (lenient: only `op`/`d`/`s`/`t` matter to Crow). */
const gatewayMessageSchema = z.object({
  op: z.number().int(),
  d: z.unknown().optional(),
  s: z.number().int().nullable().optional(),
  t: z.string().nullable().optional(),
});

export type GatewayMessage = z.infer<typeof gatewayMessageSchema>;

/** A modal text-input component within an interaction. */
export interface GatewayInteractionComponent {
  readonly custom_id?: string;
  readonly value?: string;
}

/** A minimal interaction extracted from an INTERACTION_CREATE dispatch. */
export interface GatewayInteraction {
  readonly id: string;
  readonly type: number;
  readonly token: string;
  readonly userId?: string;
  readonly channelId?: string;
  readonly data?: {
    readonly custom_id?: string;
    readonly values?: readonly string[];
    readonly components?: readonly { readonly components?: readonly GatewayInteractionComponent[] }[];
  };
}

export const identifyPayload = (token: string, intents: number): string =>
  JSON.stringify({
    op: 2,
    d: {
      token,
      intents,
      properties: { os: process.platform, browser: 'crow', device: 'crow' },
    },
  });

export const resumePayload = (token: string, sessionId: string, seq: number | null): string =>
  JSON.stringify({ op: 6, d: { token, session_id: sessionId, seq } });

export const heartbeatPayload = (seq: number | null): string =>
  JSON.stringify({ op: 1, d: seq });

/** Reads the heartbeat interval from a HELLO message, or null if malformed. */
export const readHeartbeatInterval = (message: GatewayMessage): number | null => {
  const result = helloSchema.safeParse(message);
  return result.success ? result.data.d.heartbeat_interval : null;
};

/** Extracts a minimal interaction from a DISPATCH `d` field, or null. */
export const parseInteraction = (data: unknown): GatewayInteraction | null => {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as {
    id?: unknown;
    type?: unknown;
    token?: unknown;
    channel_id?: unknown;
    user?: { id?: unknown };
    member?: { user?: { id?: unknown } };
    data?: unknown;
  };
  if (typeof d.id !== 'string' || typeof d.type !== 'number' || typeof d.token !== 'string') {
    return null;
  }

  let userId: string | undefined;
  if (typeof d.user?.id === 'string') userId = d.user.id;
  else if (typeof d.member?.user?.id === 'string') userId = d.member.user.id;

  const channelId = typeof d.channel_id === 'string' ? d.channel_id : undefined;

  let interactionData: GatewayInteraction['data'];
  if (typeof d.data === 'object' && d.data !== null) {
    const inner = d.data as { custom_id?: unknown; values?: unknown; components?: unknown };
    const customId = typeof inner.custom_id === 'string' ? inner.custom_id : undefined;
    const values = Array.isArray(inner.values)
      ? inner.values.filter((value): value is string => typeof value === 'string')
      : undefined;
    const components = Array.isArray(inner.components)
      ? inner.components.map((row) => {
          const rows = (row as { components?: unknown } | null)?.components;
          const comps = Array.isArray(rows)
            ? rows
                .filter((comp): comp is object => typeof comp === 'object' && comp !== null)
                .map((comp) => {
                  const c = comp as { custom_id?: unknown; value?: unknown };
                  return {
                    ...(typeof c.custom_id === 'string' ? { custom_id: c.custom_id } : {}),
                    ...(typeof c.value === 'string' ? { value: c.value } : {}),
                  };
                })
            : [];
          return { components: comps };
        })
      : undefined;
    if (customId !== undefined || values !== undefined || components !== undefined) {
      interactionData = {
        ...(customId !== undefined ? { custom_id: customId } : {}),
        ...(values !== undefined ? { values } : {}),
        ...(components !== undefined ? { components } : {}),
      };
    }
  }

  return {
    id: d.id,
    type: d.type,
    token: d.token,
    ...(userId !== undefined ? { userId } : {}),
    ...(channelId !== undefined ? { channelId } : {}),
    ...(interactionData !== undefined ? { data: interactionData } : {}),
  };
};

/** Parses and validates a raw gateway frame, returning null when unusable. */
export const parseMessage = (raw: string): GatewayMessage | null => {
  try {
    return gatewayMessageSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
};
