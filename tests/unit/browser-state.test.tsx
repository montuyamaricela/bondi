import '../helpers/dom';
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { MatchModal } from '../../app/components/features/discover/components/MatchModal';
import { useNotifications } from '../../app/components/hooks/useNotifications';
import { NotificationItem } from '../../app/components/ui/custom/notifications/NotificationItem';
import { ThemeProvider } from '../../app/components/providers/theme-provider';
import { ThemeToggle } from '../../app/components/features/settings/components/ThemeToggle';

test('a newly mounted match opens immediately and closing calls its owner after the animation', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let closed = 0;
  const router = {
    bfcacheId: 'synthetic-bfcache',
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch() {},
  };
  try {
    await act(async () =>
      root.render(
        <AppRouterContext.Provider value={router}>
          <MatchModal
            match={{
              matchId: 'synthetic-match',
              matchedUser: { id: 'synthetic-user', name: 'Synthetic', photo: null },
            }}
            onClose={() => {
              closed++;
            }}
          />
        </AppRouterContext.Provider>,
      ),
    );
    assert.ok(document.querySelector('[role="dialog"]'));
    const close = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Keep Swiping'),
    );
    assert.ok(close);
    await act(async () => close.click());
    assert.equal(closed, 0);
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 350);
      });
    });
    assert.equal(closed, 1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('notification permission refreshes after requesting it and on browser focus', async () => {
  class SyntheticNotification {
    static permission: NotificationPermission = 'default';
    static async requestPermission() {
      this.permission = 'granted';
      return this.permission;
    }
  }
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: SyntheticNotification,
  });
  Object.assign(globalThis, { Notification: SyntheticNotification });
  function Probe() {
    const { permission, isSupported, requestPermission } = useNotifications();
    return (
      <>
        <output>{isSupported ? permission : 'unsupported'}</output>
        <button
          onClick={() => {
            void requestPermission();
          }}
        >
          Request
        </button>
      </>
    );
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Probe />));
    assert.equal(container.querySelector('output')?.textContent, 'default');
    const button = container.querySelector('button');
    assert.ok(button);
    await act(async () => button.click());
    assert.equal(container.querySelector('output')?.textContent, 'granted');
    await act(async () => {
      SyntheticNotification.permission = 'denied';
      window.dispatchEvent(new Event('focus'));
    });
    assert.equal(container.querySelector('output')?.textContent, 'denied');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('marking a notification as read does not trigger its navigation action', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let opened = 0;
  const marked: string[] = [];
  try {
    await act(async () =>
      root.render(
        <NotificationItem
          notification={{
            id: 'synthetic-notification',
            userId: 'synthetic-user',
            title: 'New message',
            content: 'Synthetic content',
            isRead: false,
            type: 'MESSAGE',
            entityId: null,
            actionUrl: null,
            metadata: null,
            createdAt: '2026-11-14T00:00:00Z',
            updatedAt: '2026-11-14T00:00:00Z',
          }}
          onMarkAsRead={(id) => {
            marked.push(id);
          }}
          onClick={() => {
            opened++;
          }}
        />,
      ),
    );
    const markAsRead = container.querySelector<HTMLButtonElement>('button[title="Mark as read"]');
    assert.ok(markAsRead);
    await act(async () => markAsRead.click());
    assert.deepEqual(marked, ['synthetic-notification']);
    assert.equal(opened, 0);
    const open = container.querySelector('button');
    assert.ok(open);
    await act(async () => open.click());
    assert.equal(opened, 1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('a saved theme hydrates with the correct selected control and no markup mismatch', async () => {
  localStorage.clear();
  const view = (
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
  const markup = renderToString(view);
  localStorage.setItem('theme', 'dark');
  const container = document.createElement('div');
  container.innerHTML = markup;
  document.body.append(container);
  const warnings: unknown[][] = [];
  const consoleError = mock.method(console, 'error', (...args: unknown[]) => {
    warnings.push(args);
  });
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, view);
    });
    const buttons = Array.from(container.querySelectorAll('button'));
    const dark = buttons.find((button) => button.textContent === 'Dark');
    const system = buttons.find((button) => button.textContent === 'System');
    assert.ok(dark);
    assert.ok(system);
    assert.equal(dark.classList.contains('bg-primary-main'), true);
    assert.equal(system.classList.contains('bg-primary-main'), false);
    assert.equal(warnings.length, 0);
  } finally {
    await act(async () => root?.unmount());
    consoleError.mock.restore();
    localStorage.clear();
    container.remove();
  }
});
