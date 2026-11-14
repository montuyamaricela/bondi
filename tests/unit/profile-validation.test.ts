import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profileEditSchema } from '../../app/components/features/profile/validation';
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

test('setup and edit accept adult age boundaries and reject minors or fractional ages', () => {
  for (const schema of [profileSetupSchema, profileEditSchema]) {
    assert.equal(schema.safeParse(profile).success, true);
    assert.equal(schema.safeParse({ ...profile, age: 100 }).success, true);
    for (const age of [17, 18.5, 101]) {
      const result = schema.safeParse({ ...profile, age });
      assert.equal(result.success, false);
      if (!result.success) assert.ok(result.error.issues.some(({ path }) => path[0] === 'age'));
    }
  }
});

test('setup and edit share collection bounds while retaining custom label values', () => {
  for (const schema of [profileSetupSchema, profileEditSchema]) {
    for (const field of ['interests', 'hobbies'] as const) {
      for (const labels of [[], Array(11).fill('Music'), ['x'.repeat(101)], [' ']])
        assert.equal(schema.safeParse({ ...profile, [field]: labels }).success, false);
      const custom = ' A custom label ';
      const valid = schema.parse({ ...profile, [field]: [custom] });
      assert.deepEqual(valid[field], [custom]);
    }
  }
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
