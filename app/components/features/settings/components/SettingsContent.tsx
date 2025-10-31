'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Palette, Shield, MapPin } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useGeolocation } from '@/app/components/hooks/useGeolocation';
import { Button } from '@/app/components/ui/button';
import { api } from '@/lib/fetch-wrapper';

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

export function SettingsContent({ user, profile }: SettingsContentProps) {
  const router = useRouter();
  const { requestLocation, isLoading: isLoadingLocation } = useGeolocation();

  const [privacySettings, setPrivacySettings] = useState({
    showOnlineStatus: profile?.showOnlineStatus ?? true,
    showDistance: profile?.showDistance ?? true,
  });

  const [hasLocation, setHasLocation] = useState(
    Boolean(profile?.latitude && profile?.longitude)
  );

  const updatePrivacySetting = async (
    key: 'showOnlineStatus' | 'showDistance',
    value: boolean
  ) => {
    try {
      const newSettings = { ...privacySettings, [key]: value };
      setPrivacySettings(newSettings);

      await api.patch('/api/profile/privacy', { [key]: value });
      toast.success('Privacy setting updated');
    } catch (error) {
      setPrivacySettings(privacySettings);
      toast.error('Failed to update privacy setting');
    }
  };

  const handleUpdateLocation = async () => {
    try {
      const coords = await requestLocation();
      await api.patch('/api/profile/location', {
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      setHasLocation(true);
      toast.success('Location updated successfully');
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to update location');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-bg-card border border-border-main rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <User className="h-5 w-5 text-primary-main" />
          <h2 className="text-xl font-semibold text-text-heading">
            Account Settings
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-muted">Email</label>
            <div className="mt-1 text-text-body">{user.email}</div>
          </div>

          <div>
            <label className="text-sm font-medium text-text-muted">Name</label>
            <div className="mt-1 text-text-body">{user.name || 'Not set'}</div>
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-border-main rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="h-5 w-5 text-primary-main" />
          <h2 className="text-xl font-semibold text-text-heading">
            Privacy Settings
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-body">
                Show Online Status
              </p>
              <p className="text-xs text-text-muted">
                Let matches see when you're online
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={privacySettings.showOnlineStatus}
                onChange={(e) =>
                  updatePrivacySetting('showOnlineStatus', e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-bg-input peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-main rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border-main after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-main"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-body">
                Show Distance
              </p>
              <p className="text-xs text-text-muted">
                Display your distance to other users
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={privacySettings.showDistance}
                onChange={(e) =>
                  updatePrivacySetting('showDistance', e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-bg-input peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-main rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border-main after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-main"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-border-main rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <MapPin className="h-5 w-5 text-primary-main" />
          <h2 className="text-xl font-semibold text-text-heading">Location</h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-text-body mb-3">
              {hasLocation
                ? 'Your location is set. Update it to show accurate distance to other users.'
                : 'Enable location to show distance to other users.'}
            </p>
            {profile?.lastLocationUpdate && (
              <p className="text-xs text-text-muted mb-3">
                Last updated:{' '}
                {new Date(profile.lastLocationUpdate).toLocaleDateString()}
              </p>
            )}
            <Button
              onClick={handleUpdateLocation}
              disabled={isLoadingLocation}
              size="sm"
            >
              {isLoadingLocation
                ? 'Getting location...'
                : hasLocation
                ? 'Update Location'
                : 'Enable Location'}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-border-main rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Palette className="h-5 w-5 text-primary-main" />
          <h2 className="text-xl font-semibold text-text-heading">
            Appearance
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-text-body mb-3">Theme</p>
            <ThemeToggle />
          </div>
        </div>
      </div>

    </div>
  );
}
