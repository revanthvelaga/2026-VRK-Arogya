import { googleClientId, loadGsiScript } from './googleAuth';

// Backing documents up to the customer's own Google Drive. `drive.file`
// only lets this app see files it created itself — never the rest of
// their Drive. Everything goes into one "Arogya documents" folder.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Arogya documents';

export const googleDriveAvailable = Boolean(googleClientId);

let token: { value: string; expiresAt: number } | null = null;

// Load Google's script early so the tap on "Back up" can open the
// Google window straight away (browsers block pop-ups opened too late).
export function prepareGoogleDrive(): void {
  if (googleDriveAvailable) loadGsiScript().catch(() => undefined);
}

function getToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return Promise.resolve(token.value);
  return loadGsiScript().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const oauth2 = window.google?.accounts.oauth2;
        if (!googleClientId || !oauth2) {
          reject(new Error('Google Drive is not available right now.'));
          return;
        }
        const client = oauth2.initTokenClient({
          client_id: googleClientId,
          scope: DRIVE_SCOPE,
          callback: (res) => {
            if (!res.access_token) {
              reject(new Error('Google Drive access was not allowed.'));
              return;
            }
            token = { value: res.access_token, expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000 };
            resolve(res.access_token);
          },
          error_callback: (err) =>
            reject(
              new Error(
                err.type === 'popup_closed'
                  ? 'The Google window was closed before finishing.'
                  : 'Could not open Google. Allow pop-ups for this site and try again.',
              ),
            ),
        });
        client.requestAccessToken({ prompt: '' });
      }),
  );
}

async function drive<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    if (res.status === 401) token = null;
    throw new Error(
      res.status === 403
        ? 'Google Drive refused the upload. Check that your Drive has free space.'
        : `Google Drive error (${res.status}). Please try again.`,
    );
  }
  return res.json() as Promise<T>;
}

async function folderId(accessToken: string): Promise<string> {
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await drive<{ files: Array<{ id: string }> }>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`,
  );
  if (found.files.length) return found.files[0].id;
  const created = await drive<{ id: string }>(accessToken, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return created.id;
}

export interface DriveUpload {
  name: string;
  load: () => Promise<Blob>;
}

// Uploads each file into the "Arogya documents" folder; returns the
// Drive link for each, in order. Must start from a tap (it may open
// Google's sign-in window).
export async function uploadToGoogleDrive(files: DriveUpload[]): Promise<string[]> {
  const accessToken = await getToken();
  const parent = await folderId(accessToken);
  const links: string[] = [];
  for (const f of files) {
    const blob = await f.load();
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: f.name, parents: [parent] })], { type: 'application/json' }));
    form.append('file', blob);
    const up = await drive<{ id: string; webViewLink?: string }>(
      accessToken,
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      { method: 'POST', body: form },
    );
    links.push(up.webViewLink ?? `https://drive.google.com/file/d/${up.id}/view`);
  }
  return links;
}
