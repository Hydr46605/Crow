import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { listAuditLogEntries, summarizeAuditEntry } from '../../src/tools/audit-log.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

describe('summarizeAuditEntry', () => {
  it('maps a raw entry to a compact summary', () => {
    expect(
      summarizeAuditEntry({
        id: '1',
        user_id: 'u',
        target_id: 't',
        action_type: 22,
        reason: 'x',
        changes: [{ key: 'name' }],
      }),
    ).toEqual({
      id: '1',
      actionType: 22,
      userId: 'u',
      targetId: 't',
      reason: 'x',
      changes: [{ key: 'name' }],
    });
  });
});

describe('listAuditLogEntries', () => {
  it('requests the audit-logs route with filters and summarizes entries', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return {
        audit_log_entries: [
          { id: '1', user_id: null, target_id: null, action_type: 20, reason: null },
        ],
      };
    });

    const result = await listAuditLogEntries(
      { guildId: 'g', userId: 'u', actionType: 20, limit: 10 },
      createContext(discord),
    );

    expect(captured?.r).toBe('/guilds/g/audit-logs');
    expect(captured?.o.query).toEqual({ user_id: 'u', action_type: 20, before: undefined, limit: 10 });
    expect(textOf(result)).toContain('"actionType": 20');
  });
});
