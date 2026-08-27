import { useEffect, useState } from 'react';

export function useOfflineDraft<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error: unknown) {
      console.error('Failed to save draft', error);
    }
  }, [key, value]);

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(key);
    } catch (error: unknown) {
      console.error('Failed to clear draft', error);
    }
    setValue(initialValue);
  };

  return [value, setValue, clearDraft] as const;
}