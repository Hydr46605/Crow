import { describe, expect, it } from 'vitest';
import {
  GATEWAY_GUILD_MEMBERS,
  GATEWAY_GUILD_MEMBERS_LIMITED,
  GATEWAY_MESSAGE_CONTENT,
  GATEWAY_MESSAGE_CONTENT_LIMITED,
  hasMissingIntents,
  reportIntents,
} from '../../src/cli/checker.js';

describe('reportIntents', () => {
  it('reports both intents enabled when their full flags are set', () => {
    const flags = GATEWAY_GUILD_MEMBERS | GATEWAY_MESSAGE_CONTENT;
    expect(reportIntents(flags)).toEqual({ guildMembers: 'enabled', messageContent: 'enabled' });
  });

  it('reports limited when only the limited flags are set', () => {
    const flags = GATEWAY_GUILD_MEMBERS_LIMITED | GATEWAY_MESSAGE_CONTENT_LIMITED;
    expect(reportIntents(flags)).toEqual({ guildMembers: 'limited', messageContent: 'limited' });
  });

  it('prefers the full flag over the limited one', () => {
    const flags = GATEWAY_GUILD_MEMBERS | GATEWAY_GUILD_MEMBERS_LIMITED;
    expect(reportIntents(flags).guildMembers).toBe('enabled');
  });

  it('reports disabled when no flags are set', () => {
    expect(reportIntents(0)).toEqual({ guildMembers: 'disabled', messageContent: 'disabled' });
  });
});

describe('hasMissingIntents', () => {
  it('is false when both intents are enabled', () => {
    expect(hasMissingIntents({ guildMembers: 'enabled', messageContent: 'enabled' })).toBe(false);
  });

  it('is true when GUILD_MEMBERS is disabled', () => {
    expect(hasMissingIntents({ guildMembers: 'disabled', messageContent: 'enabled' })).toBe(true);
  });

  it('is true when MESSAGE_CONTENT is disabled', () => {
    expect(hasMissingIntents({ guildMembers: 'enabled', messageContent: 'disabled' })).toBe(true);
  });
});
