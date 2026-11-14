import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateDistance, formatDistance } from '../../lib/geolocation';

test('distance between London and Paris is approximately 344 kilometers', () => {
  const distance = calculateDistance(
    { latitude: 51.5074, longitude: -0.1278 },
    { latitude: 48.8566, longitude: 2.3522 },
  );
  assert.ok(distance >= 340 && distance <= 350, `Expected about 344 km, received ${distance}`);
});

test('distance labels preserve the near and far display boundaries', () => {
  assert.equal(formatDistance(0), 'Less than 1 km away');
  assert.equal(formatDistance(1), '1 km away');
  assert.equal(formatDistance(50), '50 km away');
  assert.equal(formatDistance(123.6), '124 km away');
});

test('distance calculations retain fractions for radius eligibility', () => {
  const distance = calculateDistance(
    { latitude: 0, longitude: 0 },
    { latitude: (1.4 / 6371) * (180 / Math.PI), longitude: 0 },
  );
  assert.ok(Math.abs(distance - 1.4) < 1e-10);
  assert.ok(distance > 1, 'A point outside a 1 km radius must not round into it');
});

test('valid antipodal coordinates yield a finite distance outside nearby radii', () => {
  const distance = calculateDistance(
    { latitude: 8, longitude: 0 },
    { latitude: -8, longitude: 180 },
  );
  assert.ok(Number.isFinite(distance));
  assert.ok(distance > 20_000 && distance < 20_020);
});
