import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../utils/constants';

import { backend } from '../platform';

interface SettingsStore {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  initSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS as AppSettings,
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS as AppSettings }),
      initSettings: async () => {
        const currentSettings = get().settings;
        if (!currentSettings.outputDir) {
          try {
            const defaultDir = await backend.getDefaultOutputDir();
            set((state) => ({
              settings: { ...state.settings, outputDir: defaultDir }
            }));
          } catch (error) {
            console.error('Failed to get default output directory:', error);
          }
        }
      }
    }),
    {
      name: 'audioextract-settings-store',
    }
  )
);
