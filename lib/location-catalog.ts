// Shared by the explicit reference-data importer and bounded server search.
export const LOCATION_CATALOG_ID = 'geonames-cities500';

export function normalizeCityName(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function catalogNames(text: string, type: 'country' | 'region'): Map<string, string> {
  const names = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const fields = line.split('\t');
    const name = fields[type === 'country' ? 4 : 1];
    if (!fields[0] || !name) throw new Error('Invalid city reference names');
    names.set(fields[0], name);
  }
  return names;
}

export function parseCatalogCity(
  line: string,
  countries: ReadonlyMap<string, string>,
  regions: ReadonlyMap<string, string>,
) {
  const fields = line.split('\t');
  const [id, name, asciiName, aliases, rawLatitude, rawLongitude] = fields;
  const countryCode = fields[8];
  const country = countries.get(countryCode);
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (
    fields.length !== 19 ||
    !/^\d{1,10}$/.test(id) ||
    !name?.trim() ||
    name.length > 200 ||
    !/^[A-Z]{2}$/.test(countryCode) ||
    !country ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawLatitude) ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawLongitude) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new Error('Invalid city reference row');
  const names = [
    ...new Set([name, asciiName, ...aliases.split(',')].map(normalizeCityName)),
  ].filter(Boolean);
  if (names.some((term) => term.length > 400)) throw new Error('Invalid city reference alias');
  return {
    id,
    name,
    country,
    countryCode,
    latitude,
    longitude,
    region: regions.get(`${countryCode}.${fields[10]}`) ?? null,
    names,
  };
}
