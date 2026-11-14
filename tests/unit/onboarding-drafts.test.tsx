import '../helpers/dom';
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { clearProfileSetupDrafts, profileSetupDraftKey } from '../../lib/client/profile-drafts';
import { useLocalStorage } from '../../app/components/hooks/useLocalStorage';

test('account transition removes unowned/other drafts and logout preserves unrelated preferences', () => {
  localStorage.clear();
  try {
    const alice = profileSetupDraftKey('synthetic-alice');
    const bob = profileSetupDraftKey('synthetic-bob');
    localStorage.setItem(alice, 'synthetic-private-a');
    localStorage.setItem(bob, 'synthetic-private-b');
    localStorage.setItem('profile-setup-form', 'unowned-legacy-private-data');
    localStorage.setItem('theme', 'dark');
    clearProfileSetupDrafts('synthetic-bob');
    assert.equal(localStorage.getItem(alice), null);
    assert.equal(localStorage.getItem('profile-setup-form'), null);
    assert.equal(localStorage.getItem(bob), 'synthetic-private-b');
    clearProfileSetupDrafts();
    assert.equal(localStorage.getItem(bob), null);
    assert.equal(localStorage.getItem('theme'), 'dark');
  } finally {
    localStorage.clear();
  }
});

test('a malformed private draft falls back safely without logging its key or contents', async () => {
  const key = profileSetupDraftKey('synthetic-private-account');
  const privateText = 'synthetic-private-bio-do-not-log';
  localStorage.setItem(key, `{"data":"${privateText}`);
  const errors: unknown[][] = [];
  const logged = mock.method(console, 'error', (...args: unknown[]) => {
    errors.push(args);
  });
  function Probe() {
    const [value] = useLocalStorage(key, 'safe-default', 10);
    return <output>{value}</output>;
  }
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Probe />));
    assert.equal(container.querySelector('output')?.textContent, 'safe-default');
    assert.equal(errors.length, 1);
    assert.equal(JSON.stringify(errors).includes(privateText), false);
    assert.equal(JSON.stringify(errors).includes(key), false);
  } finally {
    await act(async () => root.unmount());
    logged.mock.restore();
    localStorage.clear();
    container.remove();
  }
});
