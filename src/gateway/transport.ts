import { ActionRuntime } from '../actions/runtime.js';
import { loadConfig } from '../config.js';
import { DiscordClient } from '../discord/client.js';
import { redactSecrets } from '../security/redact.js';
import { GatewayConnection } from './connection.js';
import { createNativeSocket } from './socket.js';

/**
 * Boots the always-on gateway daemon.
 *
 * Connects to Discord's Gateway, resolves incoming component and modal
 * interactions against the registered actions, and replies with the matching
 * callback. Logs are redacted so the bot token never reaches stdout.
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
    onInteraction: async (interaction) => {
      const dispatch = actions.resolve(interaction);
      if (!dispatch.matched || !dispatch.callback) return;
      await discord.interactionCallback(interaction.id, interaction.token, dispatch.callback);
      log(`gateway: dispatched "${dispatch.customId ?? ''}"`);
    },
  });

  connection.connect();

  const shutdown = (): void => {
    connection.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};
