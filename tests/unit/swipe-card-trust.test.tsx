import '../helpers/dom';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SwipeCard } from '../../app/components/features/discover/components/SwipeCard';
import type { DiscoverableProfile } from '../../app/components/features/discover/types';

test('ordinary profiles show their information without a verification signal, with or without photos', () => {
  const profile: DiscoverableProfile = {
    id: 'synthetic-profile',
    userId: 'synthetic-user',
    name: 'Synthetic Unverified',
    age: 28,
    bio: 'A synthetic ordinary profile.',
    gender: 'OTHER',
    location: null,
    interests: ['Music'],
    hobbies: ['Reading'],
    lookingFor: null,
    relationshipType: 'CASUAL',
    showDistance: false,
    distance: null,
    photos: [],
    compatibilityScore: 0,
  };
  const photo = {
    id: 'synthetic-photo',
    key: 'synthetic-key',
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
  };
  for (const photos of [[], [photo]]) {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <SwipeCard profile={{ ...profile, photos }} onLike={() => {}} onPass={() => {}} />,
    );
    assert.equal(container.querySelector('h2')?.textContent, 'Synthetic Unverified, 28');
    assert.ok(container.textContent?.includes(profile.bio));
    const nameLine = container.querySelector('h2')?.parentElement;
    assert.ok(nameLine);
    assert.equal(
      nameLine.querySelectorAll('.lucide-check').length,
      0,
      'a photo does not establish identity verification',
    );
    assert.equal(container.querySelectorAll('img').length, photos.length);
  }
});
