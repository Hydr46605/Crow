import { readFileSync } from 'node:fs';

interface PackageMetadata {
  readonly version: string;
}

const readPackageVersion = (): string => {
  const url = new URL('../package.json', import.meta.url);
  const pkg = JSON.parse(readFileSync(url, 'utf8')) as PackageMetadata;
  return pkg.version;
};

/** Server name reported to MCP clients. */
export const NAME = 'crow';

/** Server version reported to MCP clients, read from package.json. */
export const VERSION = readPackageVersion();
