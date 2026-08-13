import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { z } from 'zod';

/** Base shape for a file source, shared by the refined schema and its extensions. */
export const fileSourceShape = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .optional()
    .describe('File name to use (defaults to the source name).'),
  path: z.string().min(1).optional().describe('Local file path to read the file from.'),
  url: z.string().url().optional().describe('URL to download the file from.'),
  data: z
    .string()
    .min(1)
    .optional()
    .describe('Base64-encoded file bytes, or a full data URI.'),
});

/** Requires exactly one of `path`, `url`, or `data` on a file source. */
export const requireSingleFileSource = (
  source: { path?: unknown; url?: unknown; data?: unknown },
  ctx: z.RefinementCtx,
): void => {
  const given = [source.path, source.url, source.data].filter((value) => value !== undefined);
  if (given.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one of "path", "url", or "data".',
    });
  }
};

/** Discriminated file source: exactly one of `path`, `url`, or `data`. */
export const fileSourceSchema = fileSourceShape.superRefine(requireSingleFileSource);

export type FileSourceInput = z.infer<typeof fileSourceSchema>;

/** A file resolved to bytes plus a content type, ready to upload. */
export interface ResolvedFile {
  readonly name: string;
  readonly data: Buffer;
  readonly contentType: string;
}

/** Discord message attachment limit (25 MB for unboosted servers). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Discord guild sticker file limit. */
export const MAX_STICKER_BYTES = 512 * 1024;

/** Discord custom emoji image limit. */
export const MAX_EMOJI_BYTES = 256 * 1024;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.apng': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.lottie': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

/** Infers a MIME type from a file name, defaulting to octet-stream. */
export const inferContentType = (name: string): string =>
  CONTENT_TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream';

const assertSize = (bytes: number, maxBytes: number): void => {
  if (bytes > maxBytes) {
    throw new Error(`File is ${bytes} bytes, exceeding the ${maxBytes} byte limit.`);
  }
};

/** Decodes a data URI (or bare base64) into bytes and a content type. */
export const decodeData = (input: string): { data: Buffer; contentType: string } => {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(input);
  if (match) {
    const [, mime, isBase64, payload] = match;
    return {
      data: isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(payload, 'utf8'),
      contentType: mime || 'application/octet-stream',
    };
  }
  return { data: Buffer.from(input, 'base64'), contentType: 'application/octet-stream' };
};

/** Resolves a file source into bytes plus a content type, enforcing `maxBytes`. */
export const resolveFile = async (source: FileSourceInput, maxBytes: number): Promise<ResolvedFile> => {
  if (source.path !== undefined) {
    const data = await readFile(source.path);
    assertSize(data.byteLength, maxBytes);
    const name = source.name ?? basename(source.path);
    return { name, data, contentType: inferContentType(name) };
  }

  if (source.url !== undefined) {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}.`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    assertSize(data.byteLength, maxBytes);
    const name = source.name ?? basename(new URL(source.url).pathname);
    const headerType = response.headers.get('content-type');
    return {
      name,
      data,
      contentType: source.name !== undefined ? inferContentType(source.name) : (headerType ?? inferContentType(name)),
    };
  }

  const input = source.data;
  if (input === undefined) {
    throw new Error('Missing file data.');
  }
  const decoded = decodeData(input);
  assertSize(decoded.data.byteLength, maxBytes);
  const name = source.name ?? 'file';
  return {
    name,
    data: decoded.data,
    contentType: source.name !== undefined ? inferContentType(source.name) : decoded.contentType,
  };
};

/** Serializes a resolved file as a base64 data URI (used by emoji upload). */
export const toDataUri = (file: ResolvedFile): string =>
  `data:${file.contentType};base64,${file.data.toString('base64')}`;
