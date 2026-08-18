import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { errorResult } from '../tools/result.js';

type RegisterToolConfig = { readonly annotations?: ToolAnnotations };
type RawHandler = (args: unknown, extra: unknown) => unknown;

/**
 * Wraps every `server.registerTool` call so a blocked tool refuses at the single
 * registration boundary instead of running its handler.
 *
 * The tool stays registered, so it still appears in `tools/list` — the
 * "listed but refused" behavior — and returns a clear error when called.
 */
export const installBlocklistGuard = (server: McpServer, ctx: CrowContext): void => {
  const original = server.registerTool.bind(server) as unknown as (name: string, config: unknown, cb: unknown) => unknown;

  const guarded = (name: string, config: RegisterToolConfig, cb: RawHandler) => {
    const handler = async (args: unknown, extra: unknown): Promise<unknown> => {
      const reason = await ctx.blocklist.match(name, config.annotations, args);
      if (reason !== null) {
        return errorResult(`Blocked by config: ${reason}`);
      }
      return cb(args, extra);
    };
    return original(name, config, handler);
  };

  server.registerTool = guarded as unknown as McpServer['registerTool'];
};
