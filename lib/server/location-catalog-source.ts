import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CATALOG_FILES = ['cities500.txt', 'countryInfo.txt', 'admin1CodesASCII.txt'] as const;

export function readCatalogFiles(directory: string, checksums: Record<string, string>) {
  return Object.fromEntries(
    CATALOG_FILES.map((name) => {
      const bytes = readFileSync(join(directory, name));
      if (
        !/^[a-f0-9]{64}$/.test(checksums[name] ?? '') ||
        createHash('sha256').update(bytes).digest('hex') !== checksums[name]
      )
        throw new Error('City reference checksum mismatch');
      return [name, bytes.toString('utf8')];
    }),
  );
}
