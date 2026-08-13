/**
 * Visual verification harness (dev-only, not part of the app bundle).
 *
 * Boots the real Vite dev server, stubs the Tauri IPC layer in the page so
 * the UI can be driven without a Rust backend, and screenshots each screen
 * in both themes.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/shots';
mkdirSync(OUT, { recursive: true });

const TAURI_STUB = () => {
  const listeners = {};
  const info = [
    {
      id: 'a1',
      title: 'Lo-fi beats to study to — 3 hour mix',
      duration: 10_842,
      uploader: 'Chillhop Records',
      platform: 'youtube',
      originalUrl: 'https://youtube.com/watch?v=a1',
    },
    {
      id: 'a2',
      title: 'Rainy night jazz session (live)',
      duration: 2_730,
      uploader: 'Blue Room Sessions',
      platform: 'youtube',
      originalUrl: 'https://youtube.com/watch?v=a2',
    },
    {
      id: 'a3',
      title: 'Deep focus ambient — no ads',
      duration: 5_405,
      uploader: 'Ambient Archive',
      platform: 'youtube',
      originalUrl: 'https://youtube.com/watch?v=a3',
    },
  ];

  window.__TAURI_INTERNALS__ = {
    transformCallback: (cb) => {
      const id = Math.floor(Math.random() * 1e9);
      window[`_${id}`] = cb;
      return id;
    },
    invoke: async (cmd, args) => {
      if (cmd === 'fetch_video_info') return info;
      if (cmd === 'get_default_output_dir') return '/Users/ken/Music/AudioExtract';
      if (cmd === 'plugin:event|listen') {
        listeners[args.event] = args.handler;
        return 0;
      }
      if (cmd === 'plugin:event|unlisten') return null;
      if (cmd === 'download_media') return new Promise(() => {});
      return null;
    },
  };

  // Seed a realistic library so the Library screen isn't empty.
  localStorage.setItem(
    'audioextract-download-store',
    JSON.stringify({
      state: {
        history: [
          {
            id: 'h1',
            title: 'Lo-fi beats to study to — 3 hour mix.mp3',
            url: 'https://youtube.com/watch?v=a1',
            mode: 'audio',
            outputPath: '/Users/ken/Music/lofi.mp3',
            fileSize: 248_500_000,
            completedAt: 1_760_000_000_000,
          },
        ],
      },
      version: 0,
    }),
  );
};

const shot = async (page, name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

const run = async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 760 } });
  await page.addInitScript(TAURI_STUB);

  await page.goto('http://localhost:1420', { waitUntil: 'networkidle' });

  // 1 — empty extract screen
  await shot(page, '01-extract-empty-dark');

  // 2 — light theme, same screen
  await page.getByRole('button', { name: /light theme/i }).click();
  await shot(page, '02-extract-empty-light');
  await page.getByRole('button', { name: /dark theme/i }).click();

  // 3 — playlist loaded
  await page.getByPlaceholder(/paste/i).fill('https://youtube.com/playlist?list=xyz');
  await page.getByRole('button', { name: 'Fetch' }).click();
  await shot(page, '03-extract-playlist-dark');

  // 4 — running job
  await page.getByTestId('submit-media-btn').click();
  await shot(page, '04-extract-running-dark');

  // 5 — library + 6 settings
  await page.getByRole('button', { name: /Library/ }).click();
  await shot(page, '05-library-dark');

  await page.getByRole('button', { name: /Settings/ }).click();
  await shot(page, '06-settings-dark');

  await page.getByRole('button', { name: /light theme/i }).click();
  await shot(page, '07-settings-light');

  await browser.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
