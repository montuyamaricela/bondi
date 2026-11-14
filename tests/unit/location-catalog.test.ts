import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogNames, normalizeCityName, parseCatalogCity } from '../../lib/location-catalog';
import { CATALOG_FILES, readCatalogFiles } from '../../lib/server/location-catalog-source';

const countries = catalogNames('# country reference\nPH\tPHL\t608\tRP\tPhilippines', 'country');
const regions = catalogNames('PH.00\tMetro Manila\tMetro Manila\t1', 'region');
const row = [
  '900000001',
  'Sán José',
  'San Jose',
  'SAN JOSE,San José,Sample alternate',
  '0',
  '0',
  'P',
  'PPL',
  'PH',
  '',
  '00',
  '',
  '',
  '',
  '501',
  '',
  '0',
  'Asia/Manila',
  '2026-11-14',
];

test('city reference parsing retains zero points and disambiguation with normalized aliases', () => {
  const city = parseCatalogCity(row.join('\t'), countries, regions);
  assert.deepEqual(city, {
    id: '900000001',
    name: 'Sán José',
    country: 'Philippines',
    countryCode: 'PH',
    latitude: 0,
    longitude: 0,
    region: 'Metro Manila',
    names: ['san jose', 'sample alternate'],
  });
  assert.equal(normalizeCityName('  SÃO   JOSÉ '), 'sao jose');
  assert.equal(parseCatalogCity(row.join('\t'), countries, new Map()).region, null);
});

test('city reference parser rejects malformed IDs, points, country references and shape', () => {
  for (const [index, value] of [
    [0, 'bad-id'],
    [1, ' '],
    [4, ''],
    [4, ' '],
    [4, '0x10'],
    [4, 'NaN'],
    [4, 'Infinity'],
    [4, '90.1'],
    [5, '-180.1'],
    [8, 'XX'],
  ] as const) {
    const invalid = [...row];
    invalid[index] = value;
    assert.throws(
      () => parseCatalogCity(invalid.join('\t'), countries, regions),
      /Invalid city reference/,
    );
  }
  assert.throws(() => parseCatalogCity(row.slice(1).join('\t'), countries, regions));
  assert.throws(() => catalogNames('invalid', 'country'), /Invalid city reference/);
});

test('reference setup rejects changed or missing source snapshots before database access', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bondi-city-source-'));
  try {
    const files = Object.fromEntries(CATALOG_FILES.map((name) => [name, `synthetic ${name}`]));
    const checksums = Object.fromEntries(
      Object.entries(files).map(([name, content]) => {
        writeFileSync(join(directory, name), content);
        return [name, createHash('sha256').update(content).digest('hex')];
      }),
    );
    assert.deepEqual(readCatalogFiles(directory, checksums), files);
    writeFileSync(join(directory, CATALOG_FILES[0]), 'changed snapshot');
    assert.throws(() => readCatalogFiles(directory, checksums), /checksum mismatch/);
    assert.throws(() => readCatalogFiles(directory, {}), /checksum mismatch/);
    rmSync(join(directory, CATALOG_FILES[0]));
    assert.throws(() => readCatalogFiles(directory, checksums), /ENOENT/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
