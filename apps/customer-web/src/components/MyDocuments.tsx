import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, downloadFile, fetchBlob, viewFile } from '../api/client';
import type { CustomerDocument, DocumentCategory, Patient } from '../api/types';
import { useApi } from '../lib/useApi';
import { googleDriveAvailable, prepareGoogleDrive, uploadToGoogleDrive } from '../lib/googleDrive';
import { formatDateTime } from '../lib/format';
import { LoadingLine } from './Spinner';
import { EmptyState } from './EmptyState';
import { IconCheckCircle, IconDownload, IconFileText, IconFolder, IconShieldCheck, IconUpload, IconX } from './Icons';

const CATEGORIES: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'INSURANCE', label: 'Insurance card / policy' },
  { value: 'AADHAAR', label: 'Aadhaar card' },
  { value: 'PAN', label: 'PAN card' },
  { value: 'PRESCRIPTION', label: 'Prescription' },
  { value: 'MEDICAL', label: 'Medical record' },
  { value: 'OTHER', label: 'Other' },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<DocumentCategory, string>;

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

function UploadForm({ patients, onUploaded }: { patients: Patient[]; onUploaded: () => void }) {
  const [category, setCategory] = useState<DocumentCategory>('INSURANCE');
  const [title, setTitle] = useState('');
  const [patientId, setPatientId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('That file is bigger than 10 MB.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    form.append('title', title.trim() || CATEGORY_LABEL[category]);
    if (patientId) form.append('patientId', patientId);
    setBusy(true);
    try {
      await api.upload('/documents', form);
      setTitle('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconUpload size={15} /> Add a document
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="doc-category">Type</label>
          <select id="doc-category" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="doc-person">Whose document</label>
          <select id="doc-person" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            {patients.map((p) => (
              <option key={p.id} value={p.relationship === 'SELF' ? '' : p.id}>
                {p.fullName}
                {p.relationship === 'SELF' ? ' (me)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field field-full">
          <label htmlFor="doc-title">Name (optional)</label>
          <input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`e.g. ${CATEGORY_LABEL[category]}`}
            maxLength={120}
          />
        </div>
        <div className="field field-full">
          <label htmlFor="doc-file">File (PDF or photo, up to 10 MB)</label>
          <input
            id="doc-file"
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy || !file}>
        <IconUpload size={14} /> {busy ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}

function DocumentCard({
  doc,
  owner,
  driveLink,
  onDriveSaved,
  onDeleted,
}: {
  doc: CustomerDocument;
  owner?: string;
  driveLink?: string;
  onDriveSaved: (link: string) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<'view' | 'download' | 'drive' | 'delete' | null>(null);
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
            {CATEGORY_LABEL[doc.category]}
            {owner && ` · ${owner}`} · {formatSize(doc.sizeBytes)} · {formatDateTime(doc.createdAt).split(',')[0]}
          </small>
          {driveLink && (
            <a className="doc-card-drive" href={driveLink} target="_blank" rel="noreferrer">
              <IconCheckCircle size={12} /> Backed up to Google Drive
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
        {googleDriveAvailable && !driveLink && (
          <button
            type="button"
            className="btn btn-small"
            disabled={busy !== null}
            onClick={() =>
              run('drive', async () => {
                const [link] = await uploadToGoogleDrive([{ name: doc.fileName, load: () => fetchBlob(path) }]);
                onDriveSaved(link);
              })
            }
          >
            <IconFolder size={13} /> {busy === 'drive' ? 'Saving…' : 'Save to Drive'}
          </button>
        )}
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
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    prepareGoogleDrive();
  }, []);

  const patients = (allPatients ?? []).filter((p) => !p.sharedBy);
  const nameOf = (id: string | null) => (id ? patients.find((p) => p.id === id)?.fullName : undefined);
  const docs = docsApi.data ?? [];
  const pending = docs.filter((d) => !backups[d.id]);

  const saveBackup = (id: string, link: string) => {
    setBackups((prev) => {
      const next = { ...prev, [id]: link };
      writeBackups(next);
      return next;
    });
  };

  const backUpAll = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const links = await uploadToGoogleDrive(
        pending.map((d) => ({ name: d.fileName, load: () => fetchBlob(`/documents/${d.id}/download`) })),
      );
      const next = { ...backups };
      pending.forEach((d, i) => (next[d.id] = links[i]));
      writeBackups(next);
      setBackups(next);
      setSyncMsg({ ok: true, text: `${links.length} document${links.length === 1 ? '' : 's'} saved to the "Arogya documents" folder in your Google Drive.` });
    } catch (err) {
      setSyncMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not back up to Google Drive' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <div className="doc-privacy">
        <IconShieldCheck size={15} />
        Only you can see these documents — not our staff, not your family-access contacts.
      </div>

      <UploadForm patients={patients} onUploaded={docsApi.reload} />

      {googleDriveAvailable && docs.length > 0 && (
        <div className="card drive-card">
          <div className="drive-card-head">
            <span className="doc-card-icon">
              <IconFolder size={17} />
            </span>
            <div className="doc-card-text">
              <b>Google Drive backup</b>
              <small>
                {pending.length === 0
                  ? 'All documents are backed up.'
                  : `${docs.length - pending.length} of ${docs.length} backed up. Copies go to your own Google Drive.`}
              </small>
            </div>
          </div>
          {pending.length > 0 && (
            <button type="button" className="btn btn-primary btn-small" onClick={backUpAll} disabled={syncing}>
              <IconUpload size={13} /> {syncing ? 'Backing up…' : `Back up ${pending.length} to Google Drive`}
            </button>
          )}
          {syncMsg && (
            <p className={syncMsg.ok ? 'drive-card-ok' : 'drive-card-err'} role="status">
              {syncMsg.text}
            </p>
          )}
        </div>
      )}

      {docsApi.loading && <LoadingLine label="Loading documents…" />}
      {docsApi.error && <div className="error-banner">{docsApi.error}</div>}
      {!docsApi.loading && !docsApi.error && docs.length === 0 && (
        <EmptyState
          icon={<IconFolder size={20} />}
          title="No documents yet"
          subtitle="Add your insurance card, Aadhaar or prescriptions so they're always at hand."
        />
      )}
      {docs.map((d) => (
        <DocumentCard
          key={d.id}
          doc={d}
          owner={nameOf(d.patientId)}
          driveLink={backups[d.id]}
          onDriveSaved={(link) => saveBackup(d.id, link)}
          onDeleted={docsApi.reload}
        />
      ))}
    </>
  );
}
