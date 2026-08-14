import { ActionRuntime } from '../actions/runtime.js';
import { loadConfig } from '../config.js';
import { DiscordClient } from '../discord/client.js';
import { redactSecrets } from '../security/redact.js';
import { GatewayConnection } from './connection.js';
import type { GatewayInteraction } from './payloads.js';
import { createNativeSocket } from './socket.js';

/**
 * Resolves an incoming interaction against the registered actions and replies
 * with the matching callback. Returns true when an action was dispatched.
 */
export const dispatchInteraction = async (
  actions: ActionRuntime,
  discord: DiscordClient,
  interaction: GatewayInteraction,
): Promise<boolean> => {
  const dispatch = actions.resolve(interaction);
  if (!dispatch.matched || !dispatch.callback) return false;
  await discord.interactionCallback(interaction.id, interaction.token, dispatch.callback);
  return true;
};

/**
 * Boots the always-on gateway daemon.
 *
 * Connects to Discord's Gateway, resolves incoming component and modal
 * interactions against the registered actions, and replies with the matching
 * callback. Logs (and error output) are redacted so the bot token never
 * reaches stdout.
 */
export const gateway = async (): Promise<void> => {
  const config = loadConfig();
  const discord = new DiscordClient(config.botToken);
  const actions = new ActionRuntime();
  actions.load();

  const log = (message: string): void => {
    process.stdout.write(`[crow] ${redactSecrets(message, [config.botToken])}\n`);
  };

  const connection = new GatewayConnection({
    token: config.botToken,
    socketFactory: createNativeSocket,
    onLog: log,
    onStateChange: (state) => log(`gateway: state ${state}`),
    onInteraction: async (interaction) => {
      const dispatched = await dispatchInteraction(actions, discord, interaction);
      if (dispatched) log(`gateway: dispatched "${interaction.data?.custom_id ?? ''}"`);
    },
  });

  connection.connect();

  // Keep the daemon observable and alive: log stray rejections, and exit on a
  // fatal exception so the process supervisor can restart it cleanly.
  process.on('unhandledRejection', (reason) => {
    log(`gateway: unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
  });
  process.on('uncaughtException', (error) => {
    log(`gateway: uncaught exception: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });

  const shutdown = (): void => {
    connection.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};
