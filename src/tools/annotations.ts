import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/** A tool that only reads data and never modifies its environment. */
export const READ_ONLY: ToolAnnotations = { readOnlyHint: true };

/** A tool that can destroy or irreversibly modify data. */
export const DESTRUCTIVE: ToolAnnotations = { destructiveHint: true };

/** A safe write whose repeated invocation has no additional effect. */
export const IDEMPOTENT: ToolAnnotations = { idempotentHint: true };

/** A destructive action that is also safe to repeat. */
export const DESTRUCTIVE_IDEMPOTENT: ToolAnnotations = {
  destructiveHint: true,
  idempotentHint: true,
};

/** An unrestricted escape hatch into the external world. */
export const OPEN_WORLD: ToolAnnotations = { openWorldHint: true };
