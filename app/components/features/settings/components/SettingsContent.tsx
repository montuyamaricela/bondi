'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Palette, Shield } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LocationControlCenter } from '@/app/components/features/location/components/LocationControlCenter';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/fetch-wrapper';

interface SettingsContentProps {
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
  useEffect(() => {
    if (!isPending && accountId && accountId !== props.user.id) router.refresh();
  }, [accountId, isPending, props.user.id, router]);
  if (isPending || !accountId || accountId !== props.user.id)
    return <p role="status">Checking your account settings...</p>;
  return <SettingsForAccount key={props.user.id} {...props} />;
}

function SettingsForAccount({ user, profile }: SettingsContentProps) {
  const { data: session } = useSession();
  const [privacySettings, setPrivacySettings] = useState({
    showOnlineStatus: profile?.showOnlineStatus ?? true,
  });

  const updatePrivacySetting = async (value: boolean) => {
    try {
      if (!session?.session.id) throw new Error('Session changed');
      const newSettings = { showOnlineStatus: value };
      setPrivacySettings(newSettings);

      await api.patch('/api/profile/privacy', {
        ...newSettings,
        expectedUserId: user.id,
        expectedSessionId: session?.session.id,
      });
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
                onChange={(e) => updatePrivacySetting(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-bg-input peer-checked:bg-primary-main peer-focus:ring-2 peer-focus:ring-primary-main peer-focus:outline-none after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border-main after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full"></div>
            </label>
          </div>
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
