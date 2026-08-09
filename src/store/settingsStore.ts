import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../utils/constants';

interface SettingsStore {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  initSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS as AppSettings,
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS as AppSettings }),
      initSettings: async () => {
        // Here you would normally fetch the default download directory from Tauri
        // For now, we leave it as is if it's already set.
      }
    }),
    {
      name: 'audioextract-settings-store',
    }
  )
);
