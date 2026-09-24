import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { api } from '../api/client';
import type { ReportShare } from '../api/types';
import { formatDateTime } from '../lib/format';
import { IconShare, IconX } from './Icons';

function shareUrl(token: string) {
  return `${window.location.origin}/shared/${token}`;
}

// "Share with doctor": a time-limited link to this one report, as a link
// to send or a QR code the doctor scans off the patient's phone.
export function ShareReportButton({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-small" onClick={() => setOpen(true)}>
        <IconShare size={13} /> Share
      </button>
      {/* Portalled to <body>: cards animate with transforms, which would
          otherwise trap a position:fixed overlay inside the card. */}
      {open && createPortal(<ShareDialog reportId={reportId} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ShareDialog({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [days, setDays] = useState(7);
  const [share, setShare] = useState<ReportShare | null>(null);
  const [active, setActive] = useState<ReportShare[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadActive = () =>
    api
      .get<ReportShare[]>(`/reports/${reportId}/shares`)
      .then(setActive)
      .catch(() => undefined);

  useEffect(() => {
    void loadActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  useEffect(() => {
    if (!share) return;
    QRCode.toDataURL(shareUrl(share.token), { margin: 1, width: 360, color: { dark: '#10182c', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [share]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setShare(await api.post<ReportShare>(`/reports/${reportId}/shares`, { days }));
      void loadActive();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a link');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    await api.delete(`/report-shares/${id}`);
    if (share?.id === id) {
      setShare(null);
      setQr(null);
    }
    void loadActive();
  };

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(shareUrl(share.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is still visible to copy by hand.
    }
  };

  return (
    <div className="sheet-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Share report">
        <div className="sheet-head">
          <b>Share with your doctor</b>
          <button type="button" aria-label="Close" onClick={onClose}>
            <IconX size={16} />
          </button>
        </div>

        {!share ? (
          <>
            <p className="page-sub" style={{ margin: '0 0 12px' }}>
              Anyone with the link can view this report until it expires. You can turn it off any time.
            </p>
            <div className="pill-row">
              {[1, 7, 30].map((d) => (
                <button key={d} type="button" className={`chip${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>
                  {d === 1 ? '24 hours' : `${d} days`}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={create} disabled={busy}>
              {busy ? 'Creating…' : 'Create link & QR code'}
            </button>
          </>
        ) : (
          <div className="share-result">
            {qr && <img src={qr} alt="QR code for the report link" className="share-qr" />}
            <div className="share-link">{shareUrl(share.token)}</div>
            <div className="action-row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={copy}>
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <a
                className="btn"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`My lab report: ${shareUrl(share.token)}`)}`}
              >
                WhatsApp
              </a>
            </div>
            <p className="page-sub" style={{ margin: '10px 0 0', textAlign: 'center' }}>
              Expires {formatDateTime(share.expiresAt)}
            </p>
          </div>
        )}

        {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}

        {active.length > 0 && (
          <div className="share-active">
            <div className="share-active-title">Active links</div>
            {active.map((s) => (
              <div className="share-active-row" key={s.id}>
                <span>
                  Until {formatDateTime(s.expiresAt)}
                  <small>
                    {s.viewCount} view{s.viewCount === 1 ? '' : 's'}
                  </small>
                </span>
                <button type="button" className="btn btn-small" onClick={() => revoke(s.id)}>
                  Turn off
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
