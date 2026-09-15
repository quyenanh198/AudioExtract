import { Backend } from './types';
import { webBackend } from './web';
import { tauriBackend } from './tauri';

export * from './types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** The active backend: Tauri when running inside the desktop shell, HTTP otherwise. */
export const backend: Backend = isTauri ? tauriBackend : webBackend;
