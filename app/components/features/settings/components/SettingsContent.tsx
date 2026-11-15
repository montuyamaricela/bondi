'use client';

import { useEffect, useLayoutEffect, useRef, useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Palette, Shield } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LocationControlCenter } from '@/app/components/features/location/components/LocationControlCenter';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/fetch-wrapper';
import { Button } from '@/app/components/ui/button';

interface SettingsContentProps {
  sessionId: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
  profile: {
    showOnlineStatus: boolean;
  } | null;
}

export function SettingsContent(props: SettingsContentProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const accountId = session?.user.id;
  const sessionId = session?.session.id;
  useEffect(() => {
    if (!isPending && (accountId !== props.user.id || sessionId !== props.sessionId))
      router.refresh();
  }, [accountId, sessionId, isPending, props.user.id, props.sessionId, router]);
  if (isPending || accountId !== props.user.id || sessionId !== props.sessionId)
    return <p role="status">Checking your account settings...</p>;
  return <SettingsForAccount key={`${props.user.id}:${props.sessionId}`} {...props} />;
}

function SettingsForAccount({ user, sessionId, profile }: SettingsContentProps) {
  const [privacySettings, setPrivacySettings] = useState({
    showOnlineStatus: profile?.showOnlineStatus ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const errorId = useId();
  const active = useRef(false);
  const pending = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      pending.current?.abort();
      pending.current = null;
    };
  }, []);

  const updatePrivacySetting = async (value: boolean) => {
    if (!active.current || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const previous = privacySettings;
    setSaving(true);
    setSaveError(false);
    setPrivacySettings({ showOnlineStatus: value });
    try {
      const saved = await api.patch<{ showOnlineStatus: unknown } | null>(
        '/api/profile/privacy',
        { showOnlineStatus: value, expectedUserId: user.id, expectedSessionId: sessionId },
        { signal: controller.signal },
      );
      if (!active.current || controller.signal.aborted) return;
      if (typeof saved?.showOnlineStatus !== 'boolean') throw new Error('Invalid privacy response');
      setPrivacySettings({ showOnlineStatus: saved.showOnlineStatus });
      toast.success('Privacy setting updated');
    } catch {
      if (!active.current || controller.signal.aborted) return;
      setPrivacySettings(previous);
      setSaveError(true);
      toast.error('Could not confirm your privacy setting. Refresh to check.');
    } finally {
      if (pending.current === controller) pending.current = null;
      if (active.current && !controller.signal.aborted) setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border-main bg-bg-card p-6">
        <div className="mb-6 flex items-center space-x-3">
          <User className="h-5 w-5 text-primary-main" />
          <h2 className="text-xl font-semibold text-text-heading">Account Settings</h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-text-muted">Email</p>
            <div className="mt-1 text-text-body">{user.email}</div>
          </div>

          <div>
            <p className="text-sm font-medium text-text-muted">Name</p>
            <div className="mt-1 text-text-body">{user.name || 'Not set'}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border-main bg-bg-card p-6">
        <div className="mb-6 flex items-center space-x-3">
          <Shield className="h-5 w-5 text-primary-main" />
          <h2 className="text-xl font-semibold text-text-heading">Privacy Settings</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-body">Show Online Status</p>
              <p className="text-xs text-text-muted">Let matches see when you&apos;re online</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <span className="sr-only">Show Online Status</span>
              <input
                type="checkbox"
                checked={privacySettings.showOnlineStatus}
                disabled={saving}
                aria-busy={saving}
                aria-describedby={saveError ? errorId : undefined}
                onChange={(e) => updatePrivacySetting(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-bg-input peer-checked:bg-primary-main peer-focus:ring-2 peer-focus:ring-primary-main peer-focus:outline-none after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border-main after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full"></div>
            </label>
          </div>
          {saving && <p role="status">Saving privacy setting...</p>}
          {saveError && (
            <div id={errorId} role="alert" className="text-sm text-error">
              Your change could not be confirmed. Refresh to check the saved setting.
              <Button type="button" variant="ghost" onClick={() => window.location.reload()}>
                Refresh privacy setting
              </Button>
            </div>
          )}
        </div>
      </div>

      <LocationControlCenter userId={user.id} />

      <div className="rounded-lg border border-border-main bg-bg-card p-6">
        <div className="mb-6 flex items-center space-x-3">
          <Palette className="h-5 w-5 text-primary-main" />
          <h2 className="text-xl font-semibold text-text-heading">Appearance</h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-3 text-sm font-medium text-text-body">Theme</p>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
