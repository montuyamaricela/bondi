import '../helpers/dom';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profileSetupDraftKey } from '../../lib/client/profile-drafts';
import {
  clearLegacyLocationDraft,
  LOCATION_CHANGE_KEY,
  LOCATION_CLEARED_EVENT,
  notifyLocationChange,
} from '../../lib/client/location-events';

test('clear removes owned draft location without restoring or deleting another account draft', () => {
  localStorage.clear();
  const key = profileSetupDraftKey('synthetic-owner');
  const other = profileSetupDraftKey('synthetic-other');
  localStorage.setItem(other, 'other draft');
  localStorage.setItem('profile-setup-form', 'unowned legacy draft');
  localStorage.setItem(
    key,
    JSON.stringify({
      timestamp: 123,
      data: {
        name: 'Synthetic',
        location: 'Old city',
        latitude: 0,
        longitude: 0,
        locationCityId: '123',
        showDistance: true,
      },
    }),
  );
  clearLegacyLocationDraft('synthetic-owner');
  assert.deepEqual(JSON.parse(localStorage.getItem(key)!), {
    timestamp: 123,
    data: { name: 'Synthetic' },
  });
  assert.equal(localStorage.getItem('profile-setup-form'), null);
  assert.equal(localStorage.getItem(other), 'other draft');
  for (const corrupt of ['{', 'null', '{"data":[]}', '{"latitude":0}']) {
    localStorage.setItem(key, corrupt);
    clearLegacyLocationDraft('synthetic-owner');
    assert.equal(localStorage.getItem(key), null);
  }
  localStorage.clear();
});

test('location invalidation broadcasts only a nonce and clear is local', () => {
  let cleared = 0;
  const listener = () => {
    cleared++;
  };
  window.addEventListener(LOCATION_CLEARED_EVENT, listener);
  try {
    notifyLocationChange(false);
    assert.match(localStorage.getItem(LOCATION_CHANGE_KEY)!, /^\d+:0\.\d+$/);
    assert.equal(cleared, 0);
    notifyLocationChange(true);
    assert.equal(cleared, 1);
    assert.match(localStorage.getItem(LOCATION_CHANGE_KEY)!, /^\d+:0\.\d+$/);
  } finally {
    window.removeEventListener(LOCATION_CLEARED_EVENT, listener);
    localStorage.clear();
  }
});
