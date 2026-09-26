import { useCallback, useState } from "react";

interface UserPrefs {
  sidebarCollapsed?: boolean;
}

const STORAGE_KEY = "userPrefs";

function loadPrefs(): UserPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePrefs(prefs: UserPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

interface UseUserPrefsReturn {
  prefs: UserPrefs;
  setSidebarCollapsed: (collapsed: boolean) => void;
  hasSidebarPreference: () => boolean;
}

export function useUserPrefs(): UseUserPrefsReturn {
  const [prefs, setPrefs] = useState<UserPrefs>(loadPrefs);

  const setSidebarCollapsed = useCallback((collapsed: boolean): void => {
    setPrefs((prev) => {
      const updated = { ...prev, sidebarCollapsed: collapsed };
      savePrefs(updated);
      return updated;
    });
  }, []);

  const hasSidebarPreference = useCallback((): boolean => {
    const stored = loadPrefs();
    return stored.sidebarCollapsed !== undefined;
  }, []);

  return {
    prefs,
    setSidebarCollapsed,
    hasSidebarPreference,
  };
}
