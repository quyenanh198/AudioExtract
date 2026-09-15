// Web-only server features (cookies for yt-dlp, push to Musik). Desktop
// builds never render the UI that calls these.

export interface CookiesStatus {
  present: boolean;
  size?: number;
  updatedAt?: string;
}

export interface ServerStatus {
  musik: boolean;
  cookies: CookiesStatus;
}

export interface MusikPlaylist {
  id: number;
  name: string;
  trackCount: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') message = body.error;
    } catch {
      /* not json */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const webExtras = {
  status: () => request<ServerStatus>('/api/status'),
  cookiesStatus: () => request<CookiesStatus>('/api/cookies'),
  uploadCookies: (file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return request<CookiesStatus>('/api/cookies', { method: 'POST', body: form });
  },
  deleteCookies: () => request<void>('/api/cookies', { method: 'DELETE' }),
  musikPlaylists: () => request<MusikPlaylist[]>('/api/musik/playlists'),
  importToMusik: (path: string, playlistId?: number) =>
    request<{ track: { id: number; title: string }; playlist: { id: number; name: string } | null }>('/api/musik/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, playlistId: playlistId ?? null }),
    }),
};
