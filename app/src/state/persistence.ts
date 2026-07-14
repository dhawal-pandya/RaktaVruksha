// The app deliberately keeps NO data in the browser. public/family-data.json is
// the single source of truth: edited locally in dev (write-through via the
// /__save-data endpoint), published with `npm run deploy`, and fetched fresh on
// every load. Earlier versions persisted an IndexedDB draft that shadowed the
// deployed file forever; purgeLegacyBrowserData clears that out retroactively.

/** Delete everything older builds ever stored in this origin. Fire-and-forget. */
export const purgeLegacyBrowserData = (): void => {
  try {
    indexedDB.deleteDatabase('raktavruksha');
  } catch {
    /* ignore: nothing to purge */
  }
  try {
    localStorage.removeItem('rv-view');
    localStorage.removeItem('rv-hint');
  } catch {
    /* ignore */
  }
};

export const downloadFile = (name: string, text: string): void => {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};
