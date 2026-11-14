import { profileSetupDraftKey } from './profile-drafts';

export const LOCATION_CHANGE_KEY = 'bondi:location-change';
export const LOCATION_CLEARED_EVENT = 'bondi:location-cleared';

export function notifyLocationChange(cleared: boolean) {
  try {
    // Only an invalidation nonce crosses tabs, never an owner or location value.
    localStorage.setItem(LOCATION_CHANGE_KEY, `${Date.now()}:${Math.random()}`);
  } catch {
    /* Focus revalidation still works when storage is unavailable. */
  }
  if (cleared) window.dispatchEvent(new Event(LOCATION_CLEARED_EVENT));
}

export function clearLegacyLocationDraft(userId: string) {
  const key = profileSetupDraftKey(userId);
  try {
    localStorage.removeItem('profile-setup-form');
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== 'object' ||
      !('data' in value) ||
      !value.data ||
      typeof value.data !== 'object' ||
      Array.isArray(value.data)
    ) {
      localStorage.removeItem(key);
      return;
    }
    const locationFields = new Set([
      'location',
      'latitude',
      'longitude',
      'lastLocationUpdate',
      'locationMode',
      'locationCityId',
      'cityLocationUpdate',
      'locationRevision',
      'showCity',
      'showDistance',
    ]);
    const data = Object.fromEntries(
      Object.entries(value.data).filter(([field]) => !locationFields.has(field)),
    );
    localStorage.setItem(key, JSON.stringify({ ...value, data }));
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Storage may be blocked. */
    }
    /* Failed local storage must not misreport a committed server clear. */
  }
}
