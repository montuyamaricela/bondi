import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateCompatibilityScore, rankProfilesByCompatibility } from '../../lib/matching-utils';

test('unrelated profiles have no compatibility points', () => {
  assert.equal(calculateCompatibilityScore({}, {}), 0);
});

test('shared interests, hobbies, and preferences contribute to compatibility', () => {
  const current = {
    interests: ['Music', 'Hiking'],
    hobbies: ['Cooking'],
    relationshipType: 'SERIOUS',
    lookingFor: 'Long term',
  };
  const target = {
    interests: ['Music', 'Reading'],
    hobbies: ['Cooking'],
    relationshipType: 'SERIOUS',
    lookingFor: 'Long term',
  };
  assert.equal(calculateCompatibilityScore(current, target), 30);
});

test('ranking preserves input and stable order for equally compatible profiles', () => {
  const candidates = [
    { id: 'unrelated', interests: [] },
    { id: 'first', interests: ['Music'] },
    { id: 'second', interests: ['Music'] },
  ];
  const result = rankProfilesByCompatibility({ interests: ['Music'] }, candidates);
  assert.deepEqual(
    result.map(({ id }) => id),
    ['first', 'second', 'unrelated'],
  );
  assert.deepEqual(
    candidates.map(({ id }) => id),
    ['unrelated', 'first', 'second'],
  );
});
