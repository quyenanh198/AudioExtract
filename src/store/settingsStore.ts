import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../utils/constants';

import { invoke } from '@tauri-apps/api/core';

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
            const defaultDir = await invoke<string>('get_default_output_dir');
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
