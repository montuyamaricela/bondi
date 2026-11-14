'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Palette, Shield, MapPin } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { useSession } from '@/lib/auth-client';
import { Button } from '@/app/components/ui/button';
import { api } from '@/lib/fetch-wrapper';
import { useSocket } from '@/app/components/providers/socket-provider';

interface SettingsContentProps {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  profile: {
    showOnlineStatus: boolean;
    showDistance: boolean;
    latitude: number | null;
    longitude: number | null;
    lastLocationUpdate: Date | null;
  } | null;
}

export function SettingsContent(props: SettingsContentProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const accountId = session?.user.id;
  useEffect(() => {
    if (!isPending && accountId && accountId !== props.user.id) router.refresh();
  }, [accountId, isPending, props.user.id, router]);
  if (isPending || !accountId || accountId !== props.user.id)
    return <p role="status">Checking your account settings...</p>;
  return <SettingsForAccount key={props.user.id} {...props} />;
}

function SettingsForAccount({ user, profile }: SettingsContentProps) {
  const { socket, isConnected } = useSocket();
  const location = useDeviceLocation(user.id);
  const [privacySettings, setPrivacySettings] = useState({
    showOnlineStatus: profile?.showOnlineStatus ?? true,
    showDistance: profile?.showDistance ?? true,
  });
  const savedLocation = location.savedLocation ?? profile;
  const hasLocation = savedLocation?.latitude != null && savedLocation.longitude != null;
  const updatedAt = savedLocation?.lastLocationUpdate
    ? new Date(savedLocation.lastLocationUpdate).toISOString()
    : null;

  const updatePrivacySetting = async (key: 'showOnlineStatus' | 'showDistance', value: boolean) => {
    try {
      const newSettings = { ...privacySettings, [key]: value };
      setPrivacySettings(newSettings);

      await api.patch('/api/profile/privacy', { [key]: value });
      if (key === 'showOnlineStatus' && socket && isConnected) {
        void socket
          .timeout(5000)
          .emitWithAck('presence:sync', { userIds: [], refreshOwn: true })
          .catch(() => {});
      }
      toast.success('Privacy setting updated');
    } catch {
      setPrivacySettings(privacySettings);
      toast.error('Failed to update privacy setting');
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
                onChange={(e) => updatePrivacySetting('showOnlineStatus', e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-bg-input peer-checked:bg-primary-main peer-focus:ring-2 peer-focus:ring-primary-main peer-focus:outline-none after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border-main after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-body">Show Distance</p>
              <p className="text-xs text-text-muted">Display your distance to other users</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <span className="sr-only">Show Distance</span>
              <input
                type="checkbox"
                checked={privacySettings.showDistance}
                onChange={(e) => updatePrivacySetting('showDistance', e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-bg-input peer-checked:bg-primary-main peer-focus:ring-2 peer-focus:ring-primary-main peer-focus:outline-none after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border-main after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border-main bg-bg-card p-6">
        <div className="mb-6 flex items-center space-x-3">
          <MapPin className="h-5 w-5 text-primary-main" />
          <h2 className="text-xl font-semibold text-text-heading">Location</h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-3 text-sm text-text-body">
              {hasLocation
                ? 'Your saved last-known location is used to find nearby people. Refresh it when you want.'
                : 'Enable device location to find nearby people and show distance. Location is requested only when you choose Enable or Refresh.'}
            </p>
            {hasLocation && (
              <p className="mb-3 text-xs text-text-muted">
                Last updated:{' '}
                {updatedAt ? (
                  <time dateTime={updatedAt}>
                    {new Date(updatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
                  </time>
                ) : (
                  'Unknown'
                )}
              </p>
            )}
            {location.error && (
              <p role="alert" className="mb-3 text-sm text-error">
                {location.error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  void location.refreshLocation();
                }}
                disabled={location.isLoading}
                size="sm"
              >
                {location.phase === 'requesting'
                  ? 'Getting location...'
                  : location.phase === 'saving'
                    ? 'Saving location...'
                    : hasLocation
                      ? 'Refresh Location'
                      : 'Enable Location'}
              </Button>
              {location.canRetrySave && (
                <Button
                  onClick={() => {
                    void location.retrySave();
                  }}
                  disabled={location.isLoading}
                  size="sm"
                  variant="outline"
                >
                  Retry save
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

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
