const legacyKey = 'profile-setup-form';
const prefix = `${legacyKey}:`;

export function profileSetupDraftKey(userId: string) {
  return `${prefix}${encodeURIComponent(userId)}`;
}

export function clearProfileSetupDrafts(keepUserId?: string) {
  if (typeof window === 'undefined') return;
  try {
    const keepKey = keepUserId ? profileSetupDraftKey(keepUserId) : null;
    for (const key of Object.keys(window.localStorage)) {
      if ((key === legacyKey || key.startsWith(prefix)) && key !== keepKey) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Unavailable storage must not prevent logout; do not log private draft contents.
  }
}
