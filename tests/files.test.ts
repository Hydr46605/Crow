import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  decodeData,
  fileSourceSchema,
  inferContentType,
  MAX_ATTACHMENT_BYTES,
  resolveFile,
  toDataUri,
} from '../src/files.js';

describe('inferContentType', () => {
  it('maps known extensions', () => {
    expect(inferContentType('a.png')).toBe('image/png');
    expect(inferContentType('a.JPEG')).toBe('image/jpeg');
    expect(inferContentType('a.lottie')).toBe('application/json');
    expect(inferContentType('a.mp4')).toBe('video/mp4');
  });

  it('falls back to octet-stream', () => {
    expect(inferContentType('a.unknown')).toBe('application/octet-stream');
  });
});

describe('decodeData', () => {
  it('decodes a base64 data URI', () => {
    const result = decodeData('data:image/png;base64,aGVsbG8=');
    expect(result.contentType).toBe('image/png');
    expect(result.data.toString()).toBe('hello');
  });

  it('decodes a bare base64 string', () => {
    const result = decodeData('aGVsbG8=');
    expect(result.contentType).toBe('application/octet-stream');
    expect(result.data.toString()).toBe('hello');
  });
});

describe('fileSourceSchema', () => {
  it('requires exactly one source', () => {
    expect(fileSourceSchema.safeParse({}).success).toBe(false);
    expect(fileSourceSchema.safeParse({ path: 'a', url: 'https://b' }).success).toBe(false);
    expect(fileSourceSchema.safeParse({ data: 'aGVsbG8=' }).success).toBe(true);
  });
});

describe('resolveFile', () => {
  it('resolves a data source with an inferred content type', async () => {
    const file = await resolveFile({ name: 'x.png', data: 'aGVsbG8=' }, MAX_ATTACHMENT_BYTES);
    expect(file.name).toBe('x.png');
    expect(file.contentType).toBe('image/png');
    expect(file.data.toString()).toBe('hello');
  });

  it('resolves a local path and infers the name and type', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-files-'));
    const filePath = join(dir, 'pic.png');
    writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    try {
      const file = await resolveFile({ path: filePath }, MAX_ATTACHMENT_BYTES);
      expect(file.name).toBe('pic.png');
      expect(file.contentType).toBe('image/png');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a file over the size limit', async () => {
    await expect(
      resolveFile({ data: Buffer.alloc(6).toString('base64') }, 5),
    ).rejects.toThrow('exceeding');
  });
});

describe('toDataUri', () => {
  it('serializes a file as a base64 data URI', () => {
    const uri = toDataUri({ name: 'x.png', data: Buffer.from('hi'), contentType: 'image/png' });
    expect(uri).toBe('data:image/png;base64,aGk=');
  });
});
