import { useEffect, useRef, useState } from 'react';
import { api, downloadFile, fetchBlob, viewFile } from '../api/client';
import type { CustomerDocument, DocumentCategory, Patient } from '../api/types';
import { useApi } from '../lib/useApi';
import { googleDriveAvailable, prepareGoogleDrive, uploadToGoogleDrive } from '../lib/googleDrive';
import { formatDateTime } from '../lib/format';
import { LoadingLine } from './Spinner';
import { EmptyState } from './EmptyState';
import { IconCheckCircle, IconDownload, IconFileText, IconFolder, IconShieldCheck, IconUpload, IconX } from './Icons';

// Also the order the groups are listed in.
const CATEGORIES: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN card' },
  { value: 'PRESCRIPTION', label: 'Prescriptions' },
  { value: 'MEDICAL', label: 'Medical records' },
  { value: 'OTHER', label: 'Other documents' },
];

// Which documents this browser has already backed up to Google Drive
// (doc id → Drive link). A convenience only — losing it just means the
// "Backed up" tick disappears.
const DRIVE_KEY = 'arogya_drive_backups';

function readBackups(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DRIVE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function writeBackups(map: Record<string, string>) {
  try {
    localStorage.setItem(DRIVE_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable — the ticks just won't be remembered.
  }
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function DocumentCard({
  doc,
  owner,
  driveLink,
  onDeleted,
}: {
  doc: CustomerDocument;
  owner?: string;
  driveLink?: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<'view' | 'download' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = `/documents/${doc.id}/download`;

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card doc-card">
      <div className="doc-card-top">
        <span className="doc-card-icon">
          <IconFileText size={17} />
        </span>
        <div className="doc-card-text">
          <b>{doc.title}</b>
          <small>
            {owner ? `${owner} · ` : ''}
            {formatSize(doc.sizeBytes)} · {formatDateTime(doc.createdAt).split(',')[0]}
          </small>
          {driveLink && (
            <a className="doc-card-drive" href={driveLink} target="_blank" rel="noreferrer">
              <IconCheckCircle size={12} /> Synced to Google Drive
            </a>
          )}
        </div>
      </div>
      <div className="doc-card-actions">
        <button type="button" className="btn btn-small" disabled={busy !== null} onClick={() => run('view', () => viewFile(path))}>
          {busy === 'view' ? 'Opening…' : 'View'}
        </button>
        <button
          type="button"
          className="btn btn-small"
          disabled={busy !== null}
          onClick={() => run('download', () => downloadFile(path, doc.fileName))}
        >
          <IconDownload size={13} /> {busy === 'download' ? 'Downloading…' : 'Download'}
        </button>
        <button
          type="button"
          className="btn btn-small doc-card-delete"
          disabled={busy !== null}
          aria-label={`Delete ${doc.title}`}
          onClick={() => {
            if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
            void run('delete', async () => {
              await api.delete(`/documents/${doc.id}`);
              onDeleted();
            });
          }}
        >
          <IconX size={13} /> {busy === 'delete' ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {error && (
        <div className="error-banner" style={{ margin: '10px 0 0' }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function MyDocuments() {
  const docsApi = useApi<CustomerDocument[]>(() => api.get('/documents/mine'), []);
  const { data: allPatients } = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const [backups, setBackups] = useState<Record<string, string>>(() => readBackups());
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    prepareGoogleDrive();
  }, []);

  const patients = (allPatients ?? []).filter((p) => !p.sharedBy);
  const nameOf = (id: string | null) => (id ? patients.find((p) => p.id === id)?.fullName : undefined);
  const docs = docsApi.data ?? [];
  const pending = docs.filter((d) => !backups[d.id]);
  const groups = CATEGORIES.map((c) => ({ ...c, docs: docs.filter((d) => d.category === c.value) })).filter(
    (g) => g.docs.length > 0,
  );

  // Pick → upload straight away; the server works out what each file is.
  const uploadFiles = async (files: File[]) => {
    setMessage(null);
    const tooBig = files.filter((f) => f.size > 10 * 1024 * 1024);
    const ok = files.filter((f) => f.size <= 10 * 1024 * 1024);
    let failed = 0;
    setUploading({ done: 0, total: ok.length });
    for (const [i, file] of ok.entries()) {
      const form = new FormData();
      form.append('file', file);
      try {
        await api.upload('/documents', form);
      } catch {
        failed++;
      }
      setUploading({ done: i + 1, total: ok.length });
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = '';
    docsApi.reload();
    const problems = [
      tooBig.length && `${tooBig.length} file${tooBig.length === 1 ? ' is' : 's are'} over 10 MB`,
      failed && `${failed} could not be uploaded`,
    ].filter(Boolean);
    const added = ok.length - failed;
    setMessage(
      problems.length
        ? { ok: false, text: `${added ? `${added} added. ` : ''}${problems.join(', ')}.` }
        : { ok: true, text: `${added} document${added === 1 ? '' : 's'} added and sorted.` },
    );
  };

  const syncWithGoogle = async () => {
    setMessage(null);
    if (pending.length === 0) {
      setMessage({ ok: true, text: 'Everything is already synced to your Google Drive.' });
      return;
    }
    setSyncing(true);
    try {
      const links = await uploadToGoogleDrive(
        pending.map((d) => ({ name: d.fileName, load: () => fetchBlob(`/documents/${d.id}/download`) })),
      );
      const next = { ...backups };
      pending.forEach((d, i) => (next[d.id] = links[i]));
      writeBackups(next);
      setBackups(next);
      setMessage({
        ok: true,
        text: `${links.length} document${links.length === 1 ? '' : 's'} saved to the "Arogya documents" folder in your Google Drive.`,
      });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not sync with Google Drive' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <div className="card doc-actions">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void uploadFiles(files);
          }}
        />
        <button
          type="button"
          className="btn btn-primary doc-action-btn"
          disabled={uploading !== null}
          onClick={() => fileRef.current?.click()}
        >
          <IconUpload size={16} />
          {uploading ? `Uploading ${Math.min(uploading.done + 1, uploading.total)} of ${uploading.total}…` : 'Upload'}
        </button>
        {googleDriveAvailable && (
          <button
            type="button"
            className="btn doc-action-btn"
            disabled={syncing || uploading !== null || docs.length === 0}
            onClick={syncWithGoogle}
          >
            <IconFolder size={16} />
            {syncing ? 'Syncing…' : 'Sync with Google'}
          </button>
        )}
        <p className="doc-actions-note">
          <IconShieldCheck size={13} /> PDF or photos, up to 10 MB each. Each file is sorted automatically by our AI.
          Only you can see your documents.
        </p>
        {message && (
          <p className={message.ok ? 'drive-card-ok' : 'drive-card-err'} role="status">
            {message.text}
          </p>
        )}
      </div>

      {docsApi.loading && <LoadingLine label="Loading documents…" />}
      {docsApi.error && <div className="error-banner">{docsApi.error}</div>}
      {!docsApi.loading && !docsApi.error && docs.length === 0 && (
        <EmptyState
          icon={<IconFolder size={20} />}
          title="No documents yet"
          subtitle="Tap Upload and pick your insurance card, Aadhaar or prescriptions — we'll sort them for you."
        />
      )}
      {groups.map((g) => (
        <div key={g.value}>
          <div className="account-group-title">
            {g.label} ({g.docs.length})
          </div>
          {g.docs.map((d) => (
            <DocumentCard
              key={d.id}
              doc={d}
              owner={nameOf(d.patientId)}
              driveLink={backups[d.id]}
              onDeleted={docsApi.reload}
            />
          ))}
        </div>
      ))}
    </>
  );
}
