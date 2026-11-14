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
  assert.equal(formatDistance(50), '50+ km away');
});
