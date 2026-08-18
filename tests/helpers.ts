import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ActionRuntime } from '../src/actions/runtime.js';
import { BlocklistRuntime } from '../src/blocklist/runtime.js';
import { emptyBlocklist } from '../src/blocklist/types.js';
import type { CrowContext } from '../src/context.js';
import { NoteRuntime } from '../src/notes/runtime.js';
import type {
  ApiRoute,
  DiscordClient,
  DiscordRequestOptions,
  HttpMethod,
} from '../src/discord/client.js';

export interface RecordedRequest {
  readonly method: HttpMethod;
  readonly route: ApiRoute;
  readonly options: DiscordRequestOptions;
}

export const createContext = (
  discord: DiscordClient,
  actions?: ActionRuntime,
  notes?: NoteRuntime,
): CrowContext => ({
  config: { botUserId: '123456789012345678', botToken: 'test-token' },
  discord,
  actions: actions ?? new ActionRuntime(join(tmpdir(), 'crow-test-actions.json')),
  notes: notes ?? new NoteRuntime(join(tmpdir(), 'crow-test-notes.json')),
  blocklist: new BlocklistRuntime(emptyBlocklist(), discord),
});

export const textOf = (result: CallToolResult): string => {
  const block = result.content[0];
  return block.type === 'text' ? block.text : '';
};
