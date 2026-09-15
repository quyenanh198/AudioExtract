import { useSettingsStore } from '../store/settingsStore';
import { backend } from '../platform';

export const useSettings = () => {
  const { settings, updateSettings, initSettings } = useSettingsStore();

  const selectOutputDir = async () => {
    try {
      const selectedPath = await backend.pickOutputDir();
      if (selectedPath) updateSettings({ outputDir: selectedPath });
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  return {
    settings,
    updateSettings,
    selectOutputDir,
    initSettings,
    /** Files live on the server in the web build, so there's no directory to pick. */
    canChooseOutputDir: backend.kind === 'tauri',
  };
};
