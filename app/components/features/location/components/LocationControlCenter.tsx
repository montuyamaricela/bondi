'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cityLabel } from '@/lib/location';
import { useLocationControl } from '../hooks/useLocationControl';
import { CityPicker } from './CityPicker';
import type { LocationMode } from '../types';

function SavedDate({ value }: { value: string | null }) {
  return value ? (
    <time dateTime={value}>{new Date(value).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</time>
  ) : (
    <>Unknown</>
  );
}

export function LocationControlCenter({ userId }: { userId: string }) {
  const control = useLocationControl(userId);
  const saved = control.data;
  const busy = control.phase !== 'idle';
  const hasOrigin = saved?.mode === 'DEVICE' || (saved?.mode === 'CITY' && saved.city?.available);
  const modes: Array<{ mode: LocationMode; label: string }> = [
    { mode: 'DEVICE', label: 'Device location' },
    { mode: 'CITY', label: 'City-only' },
    { mode: 'OFF', label: 'Off' },
  ];
  return (
    <section
      aria-labelledby="location-control-title"
      className="space-y-5 rounded-lg border border-border-main bg-bg-card p-6"
    >
      <div className="flex items-center gap-3">
        <MapPin className="h-5 w-5 text-primary-main" />
        <h2 id="location-control-title" className="text-xl font-semibold text-text-heading">
          Location Control Center
        </h2>
      </div>
      {!saved ? (
        <div className="space-y-3">
          {control.isLoading ? (
            <p role="status">Loading saved location settings...</p>
          ) : (
            <>
              <p role="alert">
                Saved location settings could not be loaded. Retry or reload Settings.
              </p>
              <Button
                type="button"
                onClick={() => {
                  void control.reload();
                }}
              >
                Retry loading location
              </Button>
              <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                Reload Settings
              </Button>
              <Link
                href="/login?callbackUrl=%2Fsettings"
                className="block text-primary-main underline"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div aria-label="Saved location" className="space-y-2 text-sm text-text-body">
            {saved.mode === 'DEVICE' && (
              <>
                <p className="font-medium">Last known device location</p>
                <p>
                  Last updated: <SavedDate value={saved.deviceUpdatedAt} />
                </p>
              </>
            )}
            {saved.mode === 'CITY' && saved.city && (
              <>
                <p className="font-medium">Selected city: {cityLabel(saved.city)}</p>
                <p>
                  Selected/updated: <SavedDate value={saved.cityUpdatedAt} />
                </p>
                {!saved.city.available && (
                  <p role="alert">
                    This city is unavailable. Select another listed city or turn off and clear
                    location.
                  </p>
                )}
              </>
            )}
            {saved.mode === 'OFF' && <p className="font-medium">Location is off.</p>}
            {saved.legacyLabel && (
              <p>
                Unconfirmed legacy label: {saved.legacyLabel}. This label is private and is not used
                as a city or distance origin. Select a mode or clear it.
              </p>
            )}
          </div>
          <fieldset className="flex flex-wrap gap-4">
            <legend className="mb-2 font-medium text-text-body">Location mode</legend>
            {modes.map(({ mode, label }) => (
              <label key={mode} className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="location-mode"
                  value={mode}
                  checked={control.selectedMode === mode}
                  onChange={() => control.chooseMode(mode)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {control.selectedMode === 'DEVICE' && (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Enable or Refresh intentionally saves a last-known position for nearby discovery.
                There is no background tracking. Your browser can deny permission; this app cannot
                reset that permission. You can choose City-only or Off instead.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void control.capture();
                  }}
                >
                  {saved.mode === 'DEVICE' ? 'Refresh device location' : 'Enable device location'}
                </Button>
                {control.pending && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void control.retrySave();
                    }}
                  >
                    Retry save
                  </Button>
                )}
              </div>
            </div>
          )}
          {control.selectedMode === 'CITY' && <CityPicker busy={busy} onSave={control.saveCity} />}
          {control.selectedMode === 'OFF' && (
            <Button
              type="button"
              variant="outline"
              disabled={busy && control.action === 'CLEAR'}
              onClick={() => {
                void control.clear();
              }}
            >
              Turn off and clear location
            </Button>
          )}
          {busy && (
            <p role="status">
              {control.phase === 'requesting'
                ? 'Getting device location...'
                : 'Saving location settings...'}
            </p>
          )}
          {control.error && (
            <p role="alert" className="text-sm text-error">
              {control.error}
            </p>
          )}
          {control.success && (
            <p role="status" className="text-sm">
              {control.success}
            </p>
          )}
          {control.queryError && (
            <div role="alert" className="text-sm text-error">
              Saved location could not be refreshed.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  void control.reload();
                }}
              >
                Retry loading location
              </button>
            </div>
          )}
          <fieldset className="space-y-3 border-t border-border-main pt-4">
            <legend className="font-medium">Location visibility</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={saved.showCity}
                disabled={
                  busy || (!saved.showCity && (saved.mode !== 'CITY' || !saved.city?.available))
                }
                onChange={(event) => {
                  void control.visibility({ showCity: event.target.checked });
                }}
              />
              Show selected city
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={saved.showDistance}
                disabled={busy || (!saved.showDistance && !hasOrigin)}
                onChange={(event) => {
                  void control.visibility({ showDistance: event.target.checked });
                }}
              />
              Show approximate distance
            </label>
            <p className="text-sm text-text-muted">
              These controls change what others see. Hidden city and distance still influence
              private matching; Off/Clear stops location use.
            </p>
          </fieldset>
          <div
            role="region"
            aria-label="Discovery location preview"
            className="space-y-2 rounded border border-border-main p-3 text-sm"
          >
            <h3 className="font-medium">Discovery location preview</h3>
            <p>{saved.preview.cityLabel ?? 'No city label visible'}</p>
            <p>{saved.preview.distanceMessage}</p>
            <p className="text-text-muted">
              City can appear on discovery and incoming-like cards. A distance depends on the
              viewer&apos;s location. Profile pages and chats keep their current location display
              rules.
            </p>
          </div>
          <div className="space-y-3 border-t border-border-main pt-4">
            <p id="clear-location-consequence" className="text-sm text-text-muted">
              Clear removes all saved device, city and legacy location data and turns both
              visibility settings off. General discovery stays available without a distance filter.
              Re-enabling requires a fresh device capture or city selection.
            </p>
            <Button
              type="button"
              variant="outline"
              aria-describedby="clear-location-consequence"
              disabled={busy && control.action === 'CLEAR'}
              onClick={() => {
                void control.clear();
              }}
            >
              Clear saved location
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
