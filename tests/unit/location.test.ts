import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectiveLocation, locationPreview, publicLocation } from '../../lib/location';
import { locationMutationSchema } from '../../app/components/features/location/validation';
import type { StoredLocation } from '../../app/components/features/location/types';

const device: StoredLocation = {
  locationMode: 'DEVICE',
  latitude: 0,
  longitude: 0,
  locationCityId: null,
  locationCity: null,
  showCity: false,
  showDistance: true,
};
const city: StoredLocation = {
  ...device,
  locationMode: 'CITY',
  latitude: null,
  longitude: null,
  locationCityId: '900000001',
  locationCity: {
    id: '900000001',
    name: 'Synthetic city',
    region: 'Synthetic region',
    country: 'Synthetic country',
    countryCode: 'PH',
    available: true,
    latitude: 0,
    longitude: 0,
  },
};

test('effective locations respect provenance, zero coordinates and fail closed for incomplete state', () => {
  assert.deepEqual(effectiveLocation(device), { latitude: 0, longitude: 0, source: 'DEVICE' });
  assert.deepEqual(effectiveLocation(city), { latitude: 0, longitude: 0, source: 'CITY' });
  for (const invalid of [
    { ...device, locationMode: 'OFF' as const },
    { ...device, latitude: null },
    { ...device, latitude: NaN },
    { ...device, longitude: Infinity },
    { ...device, latitude: 91 },
    { ...device, longitude: -181 },
    { ...city, locationCity: null },
    { ...city, locationCityId: 'other' },
    { ...city, latitude: 0 },
    { ...city, locationCity: { ...city.locationCity!, available: false } },
    { ...device, locationCityId: city.locationCityId, locationCity: city.locationCity },
  ])
    assert.equal(effectiveLocation(invalid), null);
});

test('public location projection omits hidden fields and only exposes approved city and distance display', () => {
  const viewer = effectiveLocation(device)!;
  const privateCity = { ...city, location: 'Unconfirmed legacy label', showDistance: false };
  assert.deepEqual(publicLocation(privateCity, viewer), {});
  const shown = publicLocation({ ...privateCity, showCity: true }, viewer);
  assert.deepEqual(shown, { location: 'Synthetic city, Synthetic region, Synthetic country' });
  const visibleDistance = publicLocation(city, viewer);
  assert.equal(visibleDistance.distance, 0);
  assert.match(
    visibleDistance.distanceLabel!,
    /Less than 1 km away; based on a selected city center/,
  );
  assert.match(visibleDistance.distanceLabel!, /^Approximate:/);
  for (const field of [
    'latitude',
    'longitude',
    'locationCityId',
    'locationCity',
    'source',
    'location',
  ])
    assert.equal(Object.hasOwn(visibleDistance, field), false);
  assert.deepEqual(publicLocation({ ...device, showDistance: false }, viewer), {});
  assert.deepEqual(publicLocation({ ...device, locationMode: 'OFF' }, viewer), {});
  assert.deepEqual(publicLocation(device), {});
});

test('distance provenance and whole-kilometer labels cover all device/city combinations', () => {
  for (const target of [device, city])
    for (const origin of [device, city]) {
      const projection = publicLocation(target, effectiveLocation(origin));
      assert.equal(projection.distance, 0);
      if (target === city || origin === city)
        assert.match(projection.distanceLabel!, /Approximate:.*selected city center/);
      else assert.match(projection.distanceLabel!, /estimated from last-known locations/);
    }
  const far = publicLocation(
    { ...device, latitude: (123.6 / 6371) * (180 / Math.PI) },
    effectiveLocation(device),
  );
  assert.equal(far.distance, 124);
  assert.match(far.distanceLabel!, /^124 km away;/);
});

test('owner preview agrees with public city visibility without inventing a viewer distance', () => {
  const visible = { ...city, showCity: true };
  const preview = locationPreview(visible);
  assert.equal(preview.cityLabel, publicLocation(visible).location);
  assert.match(preview.distanceMessage, /^Distance visible to eligible viewers; approximate/);
  assert.equal(Object.hasOwn(preview, 'distance'), false);
  assert.equal(Object.hasOwn(locationPreview(city), 'cityLabel'), false);
  assert.equal(
    locationPreview({ ...city, showDistance: false }).distanceMessage,
    'Distance hidden',
  );
  assert.equal(
    locationPreview({ ...device, locationMode: 'OFF' }).distanceMessage,
    'Distance unavailable',
  );
});

test('location mutations require owner revision and reject contradictory fields or untrusted centers', () => {
  const expected = { expectedUserId: 'synthetic-owner', expectedRevision: 0 };
  for (const action of [
    { ...expected, action: 'DEVICE', latitude: 0, longitude: 0 },
    { ...expected, action: 'CITY', cityId: '900000001' },
    { ...expected, action: 'CLEAR' },
    { ...expected, action: 'VISIBILITY', showCity: false },
  ])
    assert.equal(locationMutationSchema.safeParse(action).success, true);
  for (const invalid of [
    { action: 'CLEAR' },
    { ...expected, action: 'CLEAR', expectedUserId: '' },
    { ...expected, action: 'CLEAR', expectedRevision: -1 },
    { ...expected, action: 'CLEAR', expectedRevision: 0.5 },
    { ...expected, action: 'CLEAR', latitude: 0 },
    { ...expected, action: 'DEVICE', latitude: Infinity, longitude: 0 },
    { ...expected, action: 'DEVICE', latitude: 91, longitude: 0 },
    { ...expected, action: 'DEVICE', latitude: 0, longitude: 0, cityId: '900000001' },
    { ...expected, action: 'CITY', cityId: '900000001', latitude: 0, longitude: 0 },
    { ...expected, action: 'CITY', cityId: 'unknown' },
    { ...expected, action: 'VISIBILITY' },
    { ...expected, action: 'VISIBILITY', showCity: 'true' },
  ])
    assert.equal(locationMutationSchema.safeParse(invalid).success, false);
});
