# City reference catalog

Bondi uses the server-owned GeoNames `cities500` extract with country and first-level
administrative names. Coverage includes qualifying populated places and administrative
seats; it is not a complete address database. The reference point approximates a city
center and does not establish a person's residence or presence. See the
[GeoNames source format and coverage](https://download.geonames.org/export/dump/readme.txt).

Data attribution: **GeoNames**, [geonames.org](https://www.geonames.org/), licensed under
[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
Bondi converts the tab-separated data into reference rows and normalizes name/ASCII/
alias spellings for search. The provider supplies data without a completeness or
accuracy guarantee. No geocoding API, account, key, browser catalog or map SDK is used.

## Pinned source and explicit setup

[The manifest](../../tooling/geonames-snapshot.json) pins the 14 November 2026 snapshot
and SHA-256 of the **uncompressed** `cities500.txt`, `countryInfo.txt` and
`admin1CodesASCII.txt`. The verified snapshot contains 237,125 cities.

The exact compressed city, country and admin snapshots are versioned under
`reference-data/geonames/2026-11-14/`, outside the public directory and browser imports.
This makes setup reproducible from a fresh checkout even after the provider changes
its latest-download URLs. Extract into the ignored staging directory explicitly:

```bash
mkdir -p .agent-runs/reference-data/geonames/2026-11-14
unzip reference-data/geonames/2026-11-14/cities500.zip -d .agent-runs/reference-data/geonames/2026-11-14
gunzip -c reference-data/geonames/2026-11-14/countryInfo.txt.gz > .agent-runs/reference-data/geonames/2026-11-14/countryInfo.txt
gunzip -c reference-data/geonames/2026-11-14/admin1CodesASCII.txt.gz > .agent-runs/reference-data/geonames/2026-11-14/admin1CodesASCII.txt
```

Preparation uses `unzip` and `gunzip`; it preserves original bytes, including source
line endings.

## Updating the reference snapshot

Never silently accept changed checksums. A source update needs a reviewed archive,
manifest/version and date change, followed by a separately executed import. The
provider source files can be prepared using these commands (latest URLs are mutable):

```bash
mkdir -p .agent-runs/reference-data/geonames/2026-11-14
curl --fail --location --output .agent-runs/reference-data/geonames/2026-11-14/cities500.zip https://download.geonames.org/export/dump/cities500.zip
curl --fail --location --output .agent-runs/reference-data/geonames/2026-11-14/countryInfo.txt https://download.geonames.org/export/dump/countryInfo.txt
curl --fail --location --output .agent-runs/reference-data/geonames/2026-11-14/admin1CodesASCII.txt https://download.geonames.org/export/dump/admin1CodesASCII.txt
unzip .agent-runs/reference-data/geonames/2026-11-14/cities500.zip -d .agent-runs/reference-data/geonames/2026-11-14
```

After verifying the new source files, archive the country/admin originals with
`gzip -c`, retain the city ZIP, and update the versioned archive directory and
manifest together. Never normalize source whitespace before computing its digest.

## Importing into a database

Export the intended `DATABASE_URL` securely, explicitly apply reviewed schema
migrations with `npm run db:migrate`, then confirm the database name:

```bash
npm run cities:import -- --source-dir .agent-runs/reference-data/geonames/2026-11-14 --confirm-database your_database_name
```

The importer performs no download. It checks all source digests, validates rows and
rejects duplicate IDs before opening a transaction. Database confirmation must match
the URL. A transaction lock serializes imports; bounded batches update reference rows
and alias indexes together with the manifest metadata. Removed IDs remain stored but
unavailable, so an existing reference is not deleted or silently replaced. Name
aliases are rebuilt for available records. An import failure rolls back that
transaction. The same transaction increments the revision of City-mode profiles,
invalidating device captures started before maintenance. It retains their selection
and timestamp; unavailable selections show a reselection state and have no effective
discovery origin. `ANALYZE` refreshes planner statistics after commit; a statistics failure
does not undo an already committed catalog. Errors omit database diagnostics.

No migration, application startup, build or test command invokes this importer or
downloads data. Tests create and remove small synthetic reference fixtures; they do
not require the live source files. Reference maintenance never imports user location data.

## Search contract

`GET /api/location/cities?q=...&country=PH` requires a valid session. Queries trim to
2–80 characters; the optional country is a two-letter code. Duplicate/unknown query
parameters are rejected. Case and diacritics normalize consistently across names,
ASCII names and available aliases. Prefix search uses a PostgreSQL `text_pattern_ops`
index; `%`, `_` and backslashes are literal input, not extra search wildcards.
The result has at most 20 cities, ordered by name with C collation then stable ID,
with name, region, country and country code for disambiguation. It contains no user's
location association or coordinates.

A valid query with no matches returns an empty list. A missing/empty installed
catalog returns `503 CITY_CATALOG_UNAVAILABLE`; infrastructure errors use the existing
generic API error boundary. An unavailable city does not appear in search. City
coverage gaps require another explicit selection rather than a nearby-city fallback.
