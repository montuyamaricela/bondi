import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profileSetupSchema, signupSchema } from '../../app/components/features/auth/validation';

const profile = {
  name: 'Synthetic User',
  age: 18,
  bio: 'A synthetic test profile.',
  gender: 'OTHER',
  interests: ['Music'],
  hobbies: ['Reading'],
  relationshipType: 'FRIENDSHIP',
  genderPreference: 'EVERYONE',
};

test('profile setup accepts the adult age boundary and rejects a minor', () => {
  assert.equal(profileSetupSchema.safeParse(profile).success, true);
  const result = profileSetupSchema.safeParse({ ...profile, age: 17 });
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.error.issues.some(({ path }) => path[0] === 'age'));
});

test('profile setup requires interests and hobbies', () => {
  assert.equal(profileSetupSchema.safeParse({ ...profile, interests: [] }).success, false);
  assert.equal(profileSetupSchema.safeParse({ ...profile, hobbies: [] }).success, false);
});

test('signup rejects mismatched confirmation and weak passwords', () => {
  const input = {
    name: 'Synthetic User',
    email: 'synthetic@example.test',
    password: 'Synthetic123',
    confirmPassword: 'Synthetic123',
  };
  assert.equal(signupSchema.safeParse(input).success, true);
  const mismatch = signupSchema.safeParse({ ...input, confirmPassword: 'Other123' });
  assert.equal(mismatch.success, false);
  if (!mismatch.success)
    assert.ok(mismatch.error.issues.some(({ path }) => path[0] === 'confirmPassword'));
  assert.equal(
    signupSchema.safeParse({ ...input, password: 'abcdefgh', confirmPassword: 'abcdefgh' }).success,
    false,
  );
});
