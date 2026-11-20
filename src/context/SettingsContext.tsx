import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchSettings, saveSettings } from '../lib/api';
import { describeError } from '../lib/errors';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Settings, SettingsInput } from '../types/database';

interface SettingsContextValue {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (input: SettingsInput) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchSettings();
      setSettings(loaded);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setSettings(null);
      return;
    }
    void refresh();
  }, [session, refresh]);

  const save = useCallback(async (input: SettingsInput) => {
    const saved = await saveSettings(input);
    setSettings(saved);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loading, error, refresh, save }),
    [settings, loading, error, refresh, save],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings debe usarse dentro de SettingsProvider.');
  }
  return context;
}
