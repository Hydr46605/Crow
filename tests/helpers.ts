import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../src/context.js';
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

export const createContext = (discord: DiscordClient): CrowContext => ({
  config: { botUserId: '123456789012345678', botToken: 'test-token' },
  discord,
});

export const textOf = (result: CallToolResult): string => {
  const block = result.content[0];
  return block.type === 'text' ? block.text : '';
};
