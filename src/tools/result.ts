import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** Builds a successful tool result carrying a single text block. */
export const textResult = (text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
});

/** Builds an error tool result carrying a single text block. */
export const errorResult = (message: string): CallToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
});
