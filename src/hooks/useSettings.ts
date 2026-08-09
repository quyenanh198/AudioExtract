import { useSettingsStore } from '../store/settingsStore';
import { open } from '@tauri-apps/plugin-dialog';

export const useSettings = () => {
  const { settings, updateSettings, initSettings } = useSettingsStore();

  const selectOutputDir = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Output Directory'
      });
      
      if (selectedPath && typeof selectedPath === 'string') {
        updateSettings({ outputDir: selectedPath });
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  return {
    settings,
    updateSettings,
    selectOutputDir,
    initSettings
  };
};
