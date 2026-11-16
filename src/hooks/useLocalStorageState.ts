import { useEffect, useState } from 'react';

export function useLocalStorageState<T>(key: string, initialValue: T | (() => T)) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // Fallback to initialValue if storage is corrupted or unavailable
    }
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore quota errors cleanly
    }
  }, [key, state]);

  return [state, setState] as const;
}
