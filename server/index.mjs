// AudioExtract web backend. Mirrors the Tauri commands in src-tauri/src/commands
// so the React app can run in a browser: yt-dlp/ffmpeg run here, results land in
// $AUDIOEXTRACT_DATA_DIR/out/<taskId>/ and are served back over /api/files.
import express from 'express';
import multer from 'multer';
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.resolve(process.env.AUDIOEXTRACT_DATA_DIR || './data');
const OUT_DIR = path.join(DATA_DIR, 'out');
const IN_DIR = path.join(DATA_DIR, 'in');
const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT || 3000);
const YTDLP = process.env.YTDLP_BIN || 'yt-dlp';
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';
const MAX_PARALLEL = Number(process.env.MAX_PARALLEL_DOWNLOADS || 2);
const KEEP_DAYS = Number(process.env.KEEP_DAYS || 7);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 2048);
// Netscape cookies.txt exported from a logged-in browser; lets yt-dlp past
// YouTube's "confirm you're not a bot" wall. Optional, uploaded via the UI.
const COOKIES_FILE = path.join(DATA_DIR, 'cookies.txt');
// Base URL of the Musik server on the docker network (no auth there); when
// set, results can be pushed straight into the Musik library.
const MUSIK_URL = (process.env.MUSIK_URL || '').replace(/\/$/, '');

for (const dir of [OUT_DIR, IN_DIR]) fs.mkdirSync(dir, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.use(express.json());

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stdout, stderr }));
      else resolve({ stdout, stderr });
    });
  });

/** Resolve a client-supplied relative path inside `root`, refusing traversal. */
const inside = (root, rel) => {
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new HttpError(400, 'Invalid path');
  return abs;
};

const safeName = (name) => (name || 'audio').replace(/[\\/\0]/g, '_').replace(/^\.+/, '_').slice(0, 200);

const cookieArgs = () => (fs.existsSync(COOKIES_FILE) ? ['--cookies', COOKIES_FILE] : []);

const PROGRESS_RE = /\[download\]\s+(\d+\.?\d*)%\s+of\s+~?\s*([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+(\d+:\d+)/;
const parseProgressLine = (line) => {
  const m = PROGRESS_RE.exec(line);
  return m ? { percent: parseFloat(m[1]) || 0, speed: m[3], eta: m[4] } : null;
};

// ---------- server-sent events ----------
const clients = new Set();
const emit = (event, payload) => {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(chunk);
};

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write(': hi\n\n');
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
});

// ---------- video info ----------
app.get('/api/info', async (req, res, next) => {
  try {
    const url = String(req.query.url || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new HttpError(400, 'A http(s) URL is required');
    let stdout;
    try {
      ({ stdout } = await run(YTDLP, ['-j', '--flat-playlist', '--no-warnings', ...cookieArgs(), url], { timeout: 120_000 }));
    } catch (err) {
      throw new HttpError(502, `yt-dlp failed: ${(err.stderr || err.message || '').trim().split('\n').pop()}`);
    }
    const videos = [];
    for (const line of stdout.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('{')) continue;
      try {
        const v = JSON.parse(t);
        videos.push({
          id: String(v.id ?? ''),
          title: v.title ?? 'Unknown',
          duration: typeof v.duration === 'number' ? v.duration : 0,
          thumbnailUrl: v.thumbnail ?? undefined,
          uploader: v.uploader ?? v.channel ?? 'Unknown',
          platform: v.extractor ?? 'Unknown',
          originalUrl: v.webpage_url ?? v.url ?? undefined,
        });
      } catch {
        /* skip non-json lines */
      }
    }
    if (videos.length === 0) throw new HttpError(502, 'yt-dlp returned no video info');
    res.json(videos);
  } catch (err) {
    next(err);
  }
});

// ---------- downloads (queued, at most MAX_PARALLEL yt-dlp processes) ----------
const running = new Map(); // taskId -> ChildProcess
const queue = []; // pending jobs
const known = new Set(); // taskIds ever accepted (so cancel of a queued job works)
const results = new Map(); // taskId -> last download-finished payload (kept an hour, for clients whose SSE dropped)

const remember = (event) => {
  results.set(event.taskId, { at: Date.now(), event });
  emit('download-finished', event);
};

const pump = () => {
  while (running.size < MAX_PARALLEL && queue.length) {
    const job = queue.shift();
    if (!known.has(job.taskId)) continue; // cancelled while queued
    startJob(job);
  }
};

const finishedFileIn = async (dir) => {
  const names = (await fsp.readdir(dir)).filter((n) => !n.startsWith('.') && !/\.(part|ytdl|temp)$/i.test(n));
  if (names.length === 0) return null;
  // Newest file is the one ffmpeg wrote last (the extracted audio).
  const stats = await Promise.all(names.map(async (n) => ({ n, s: await fsp.stat(path.join(dir, n)) })));
  stats.sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
  return stats[0];
};

const startJob = ({ taskId, url, format, quality }) => {
  const dir = path.join(OUT_DIR, taskId);
  fs.mkdirSync(dir, { recursive: true });
  const args = [
    '--newline',
    '--no-playlist',
    '--no-warnings',
    ...cookieArgs(),
    '--extract-audio',
    '--audio-format',
    format,
    '--audio-quality',
    quality,
    // yt-dlp wants a directory or full path here, so only pass it when configured explicitly.
    ...(path.isAbsolute(FFMPEG) ? ['--ffmpeg-location', FFMPEG] : []),
    '-o',
    path.join(dir, '%(title).150s.%(ext)s'),
    url,
  ];
  const child = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  running.set(taskId, child);
  let errorMsg = '';
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const progress = parseProgressLine(line);
      if (progress) emit('download-progress', { taskId, progress });
      if (/\[ExtractAudio\]/.test(line)) emit('download-progress', { taskId, progress: { percent: 100, speed: '', eta: '0:00' } });
    }
  });
  child.stderr.on('data', (d) => {
    const s = d.toString();
    if (/error/i.test(s)) errorMsg += s;
  });
  child.on('close', async (code) => {
    running.delete(taskId);
    const cancelled = !known.has(taskId);
    known.delete(taskId);
    if (cancelled) {
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    } else if (code !== 0) {
      const error = errorMsg.trim() || `yt-dlp exited with code ${code}`;
      emit('download-error', { taskId, error });
      remember({ taskId, success: false, error });
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    } else {
      const file = await finishedFileIn(dir).catch(() => null);
      if (!file) {
        remember({ taskId, success: false, error: 'No output file produced' });
      } else {
        remember({ taskId, success: true, outputPath: `${taskId}/${file.n}`, fileSize: file.s.size });
      }
    }
    pump();
  });
};

const FORMATS = new Set(['mp3', 'm4a', 'wav', 'flac', 'opus', 'aac', 'ogg', 'vorbis', 'best']);

app.post('/api/download', (req, res, next) => {
  try {
    const { taskId, url, format, quality } = req.body ?? {};
    if (typeof taskId !== 'string' || !/^[\w-]{1,64}$/.test(taskId)) throw new HttpError(400, '"taskId" is required');
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new HttpError(400, 'A http(s) "url" is required');
    const fmt = String(format || 'mp3').toLowerCase();
    if (!FORMATS.has(fmt)) throw new HttpError(400, `Unsupported format: ${fmt}`);
    const q = String(quality ?? '0');
    if (!/^(\d{1,2}|\d{2,3}[kK]?)$/.test(q)) throw new HttpError(400, 'Invalid quality');
    if (known.has(taskId)) throw new HttpError(409, 'Task already exists');
    known.add(taskId);
    results.delete(taskId);
    queue.push({ taskId, url, format: fmt, quality: q });
    pump();
    res.status(202).json({ taskId, queued: running.has(taskId) ? 0 : queue.length });
  } catch (err) {
    next(err);
  }
});

app.get('/api/tasks/:taskId', (req, res) => {
  const { taskId } = req.params;
  if (running.has(taskId)) return res.json({ status: 'running' });
  if (known.has(taskId)) return res.json({ status: 'queued' });
  const done = results.get(taskId);
  if (done) return res.json({ status: 'finished', event: done.event });
  res.json({ status: 'unknown' });
});

app.post('/api/cancel', (req, res, next) => {
  try {
    const { taskId } = req.body ?? {};
    if (typeof taskId !== 'string' || !known.has(taskId)) throw new HttpError(404, 'Task not found');
    known.delete(taskId);
    const child = running.get(taskId);
    if (child) child.kill('SIGKILL');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- local files: upload, then trim/convert with ffmpeg ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(IN_DIR, randomUUID());
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, safeName(Buffer.from(file.originalname, 'latin1').toString('utf8'))),
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const rel = path.relative(IN_DIR, req.file.path);
  res.status(201).json({ path: rel, name: req.file.filename, size: req.file.size });
});

app.post('/api/trim', async (req, res, next) => {
  try {
    const { inputPath, outputPath, startTime, endTime } = req.body ?? {};
    if (typeof inputPath !== 'string' || !inputPath) throw new HttpError(400, '"inputPath" is required');
    const input = inside(IN_DIR, inputPath);
    if (!fs.existsSync(input)) throw new HttpError(404, 'Uploaded file not found (uploads expire after a day)');
    const outName = safeName(path.basename(String(outputPath || 'audio.mp3')));
    const ext = path.extname(outName).slice(1).toLowerCase();
    if (!ext) throw new HttpError(400, 'Output name needs an extension');
    const id = randomUUID();
    const dir = path.join(OUT_DIR, id);
    await fsp.mkdir(dir, { recursive: true });
    const out = path.join(dir, outName);
    const start = Number(startTime) || 0;
    const end = Number(endTime) || 0;
    const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input];
    if (start > 0) args.push('-ss', String(start));
    if (end > start) args.push('-to', String(end));
    // Same container as the source → stream copy (fast); otherwise transcode by extension.
    const sameContainer = path.extname(input).slice(1).toLowerCase() === ext;
    args.push('-vn', ...(sameContainer ? ['-c:a', 'copy'] : []), out);
    try {
      await run(FFMPEG, args, { timeout: 30 * 60_000 });
    } catch (err) {
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
      throw new HttpError(500, `ffmpeg trim failed: ${(err.stderr || err.message || '').trim().split('\n').pop()}`);
    }
    const stat = await fsp.stat(out);
    res.json({ outputPath: `${id}/${outName}`, fileSize: stat.size });
  } catch (err) {
    next(err);
  }
});

// ---------- serving & deleting results ----------
/** Every finished result on disk (newest first) — what Musik's "import from AudioExtract" lists. */
app.get('/api/files', async (_req, res, next) => {
  try {
    const out = [];
    for (const dir of await fsp.readdir(OUT_DIR).catch(() => [])) {
      const abs = path.join(OUT_DIR, dir);
      const st = await fsp.stat(abs).catch(() => null);
      if (!st?.isDirectory() || running.has(dir)) continue;
      for (const name of await fsp.readdir(abs).catch(() => [])) {
        if (name.startsWith('.') || /\.(part|ytdl|temp)$/i.test(name)) continue;
        const fst = await fsp.stat(path.join(abs, name)).catch(() => null);
        if (!fst?.isFile()) continue;
        out.push({ path: `${dir}/${name}`, name, size: fst.size, updatedAt: fst.mtime.toISOString() });
      }
    }
    out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    res.json(out);
  } catch (err) {
    next(err);
  }
});

app.get('/api/files/{*rel}', (req, res, next) => {
  try {
    const rel = [].concat(req.params.rel ?? []).join('/');
    const abs = inside(OUT_DIR, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new HttpError(404, 'File not found');
    if (req.query.download !== undefined) {
      res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(abs))}`);
    }
    res.sendFile(abs, { acceptRanges: true });
  } catch (err) {
    next(err);
  }
});

/** Rename a result in place: `{ path, name }` → new name keeps the original extension. */
app.post('/api/files/rename', async (req, res, next) => {
  try {
    const { path: rel, name } = req.body ?? {};
    if (typeof rel !== 'string' || !rel) throw new HttpError(400, '"path" is required');
    const abs = inside(OUT_DIR, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new HttpError(404, 'File not found');
    const ext = path.extname(abs);
    let base = safeName(String(name ?? '').trim());
    if (!base || base === '_') throw new HttpError(400, '"name" is required');
    if (path.extname(base).toLowerCase() === ext.toLowerCase()) base = base.slice(0, -ext.length);
    const next = path.join(path.dirname(abs), `${base}${ext}`);
    if (next !== abs && fs.existsSync(next)) throw new HttpError(409, 'A file with that name already exists');
    if (next !== abs) await fsp.rename(abs, next);
    const newRel = path.relative(OUT_DIR, next).split(path.sep).join('/');
    // Keep the remembered finish event pointing at the file for late pollers.
    const dirId = newRel.split('/')[0];
    const r = results.get(dirId);
    if (r?.event?.outputPath === rel) r.event.outputPath = newRel;
    res.json({ path: newRel, name: path.basename(next) });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/files/{*rel}', async (req, res, next) => {
  try {
    const rel = [].concat(req.params.rel ?? []).join('/');
    const abs = inside(OUT_DIR, rel);
    // Results live one per directory, so drop the whole task folder.
    const dir = path.dirname(abs);
    if (dir === OUT_DIR) throw new HttpError(400, 'Invalid path');
    await fsp.rm(dir, { recursive: true, force: true });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- cookies.txt for yt-dlp ----------
const cookiesStatus = () => {
  try {
    const st = fs.statSync(COOKIES_FILE);
    return { present: true, size: st.size, updatedAt: st.mtime.toISOString() };
  } catch {
    return { present: false };
  }
};

app.get('/api/cookies', (_req, res) => res.json(cookiesStatus()));

app.post('/api/cookies', multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }).single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'No file uploaded');
    const text = req.file.buffer.toString('utf8');
    // Netscape format: comment header or tab-separated 7-column lines.
    const looksRight = /^# (Netscape )?HTTP Cookie File/m.test(text) || text.split('\n').some((l) => l.split('\t').length >= 7);
    if (!looksRight) throw new HttpError(400, 'Not a Netscape cookies.txt file');
    await fsp.writeFile(COOKIES_FILE, text, { mode: 0o600 });
    res.status(201).json(cookiesStatus());
  } catch (err) {
    next(err);
  }
});

app.delete('/api/cookies', async (_req, res, next) => {
  try {
    await fsp.rm(COOKIES_FILE, { force: true });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- push results into Musik ----------
const AUDIO_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', flac: 'audio/flac', opus: 'audio/ogg', ogg: 'audio/ogg', oga: 'audio/ogg', webm: 'audio/webm', mka: 'audio/x-matroska' };

const musikFetch = async (route, init) => {
  if (!MUSIK_URL) throw new HttpError(404, 'Musik is not configured');
  let res;
  try {
    res = await fetch(`${MUSIK_URL}${route}`, init);
  } catch (err) {
    throw new HttpError(502, `Musik unreachable: ${err.message}`);
  }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') msg = body.error;
    } catch {
      /* not json */
    }
    throw new HttpError(502, `Musik: ${msg}`);
  }
  return res.status === 204 ? null : res.json();
};

app.get('/api/musik/playlists', async (_req, res, next) => {
  try {
    res.json(await musikFetch('/api/playlists'));
  } catch (err) {
    next(err);
  }
});

app.post('/api/musik/import', async (req, res, next) => {
  try {
    const { path: rel, playlistId } = req.body ?? {};
    if (typeof rel !== 'string' || !rel) throw new HttpError(400, '"path" is required');
    const abs = inside(OUT_DIR, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new HttpError(404, 'File not found');
    const name = path.basename(abs);
    const type = AUDIO_TYPES[path.extname(name).slice(1).toLowerCase()];
    if (!type) throw new HttpError(415, `Musik cannot play .${path.extname(name).slice(1)}`);
    const form = new FormData();
    form.append('file', new Blob([await fsp.readFile(abs)], { type }), name);
    const track = await musikFetch('/api/tracks', { method: 'POST', body: form });
    let playlist = null;
    if (playlistId !== undefined && playlistId !== null && playlistId !== '') {
      const id = Number(playlistId);
      if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid playlistId');
      playlist = await musikFetch(`/api/playlists/${id}/tracks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trackIds: [track.id] }),
      });
    }
    res.status(201).json({ track, playlist: playlist ? { id: playlist.id, name: playlist.name } : null });
  } catch (err) {
    next(err);
  }
});

app.get('/api/status', (_req, res) => res.json({ musik: Boolean(MUSIK_URL), cookies: cookiesStatus() }));

app.get('/api/health', (_req, res) => res.json({ ok: true, running: running.size, queued: queue.length }));

// ---------- housekeeping: expire old results/uploads, keep yt-dlp fresh ----------
const sweep = async (root, maxAgeMs) => {
  const now = Date.now();
  for (const name of await fsp.readdir(root).catch(() => [])) {
    const p = path.join(root, name);
    const st = await fsp.stat(p).catch(() => null);
    if (st && now - st.mtimeMs > maxAgeMs && !running.has(name)) await fsp.rm(p, { recursive: true, force: true }).catch(() => {});
  }
};
const housekeeping = () => {
  void sweep(OUT_DIR, KEEP_DAYS * 86_400_000);
  void sweep(IN_DIR, 86_400_000);
  for (const [id, r] of results) if (Date.now() - r.at > 3_600_000) results.delete(id);
};
const updateYtDlp = () =>
  run(YTDLP, ['-U'], { timeout: 120_000 })
    .then(({ stdout }) => console.log('[yt-dlp]', stdout.trim().split('\n').pop()))
    .catch((err) => console.warn('[yt-dlp] update failed:', (err.stderr || err.message || '').trim().split('\n').pop()));
housekeeping();
setInterval(housekeeping, 3_600_000).unref();
if (process.env.YTDLP_AUTO_UPDATE !== '0') {
  updateYtDlp();
  setInterval(updateYtDlp, 86_400_000).unref();
}

// ---------- SPA ----------
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: 'index.html' }));
  app.get('/{*any}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => console.log(`AudioExtract server on :${PORT}, data in ${DATA_DIR}`));
