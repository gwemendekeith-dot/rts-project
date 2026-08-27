/**
 * useNewSaleDraft — IndexedDB-backed draft persistence for the New Sale form.
 *
 * Design:
 * - Uses the IndexedDB `idb-keyval`-style API via a thin wrapper around the native
 *   IndexedDB API (no extra dependency required — just localStorage as fallback).
 * - Persists the draft on every field change (debounced 400ms).
 * - Restores the draft automatically when the component mounts.
 * - Clears the draft on successful submission.
 * - Works even when the app is fully offline.
 */

import { useCallback, useEffect, useRef } from 'react';

const DB_NAME = 'rafiki-ops-desk';
const STORE_NAME = 'drafts';
const DRAFT_KEY = 'new-sale-draft';

// ─── Thin IDB wrapper ─────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback to localStorage if IDB unavailable (private browsing, etc.)
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
  }
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try { localStorage.removeItem(key); } catch { /* noop */ }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export interface NewSaleDraftData {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  lineItems: unknown[];
  partsAmount: number;
  includeInstallation: boolean;
  referralPartnerId: string;
  amountPaidNow: number;
  paymentMethod: string;
  paymentReference: string;
  savedAt: string; // ISO timestamp
}

interface UseNewSaleDraftReturn {
  /** Persist the current form state to IndexedDB (debounced). */
  saveDraft: (data: Omit<NewSaleDraftData, 'savedAt'>) => void;
  /** Load a previously saved draft. Returns null if none exists. */
  loadDraft: () => Promise<NewSaleDraftData | null>;
  /** Permanently delete the draft (call on successful submission). */
  clearDraft: () => Promise<void>;
}

export function useNewSaleDraft(): UseNewSaleDraftReturn {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const saveDraft = useCallback((data: Omit<NewSaleDraftData, 'savedAt'>) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const withTimestamp: NewSaleDraftData = { ...data, savedAt: new Date().toISOString() };
      idbSet(DRAFT_KEY, withTimestamp).catch(() => { /* best-effort */ });
    }, 400);
  }, []);

  const loadDraft = useCallback((): Promise<NewSaleDraftData | null> => {
    return idbGet<NewSaleDraftData>(DRAFT_KEY);
  }, []);

  const clearDraft = useCallback((): Promise<void> => {
    return idbDelete(DRAFT_KEY);
  }, []);

  return { saveDraft, loadDraft, clearDraft };
}
