import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Prescription, PrescriptionMatch, TestFinderResult, TestSuggestion } from '../api/types';
import { useApi } from '../lib/useApi';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../context/CartContext';
import { LoadingLine } from '../components/Spinner';
import {
  IconAlertTriangle,
  IconFileText,
  IconPlus,
  IconSparkle,
  IconStethoscope,
  IconUpload,
  IconX,
} from '../components/Icons';
import { formatCurrency, formatDateTime } from '../lib/format';

type Tab = 'rx' | 'symptoms';

function AddButton({ kind, id, name, price }: { kind: 'test' | 'package'; id: string; name: string; price: number }) {
  const { add, remove, has } = useCart();
  const added = has(kind, id);
  return (
    <button
      type="button"
      className={`add-btn${added ? ' added' : ''}`}
      onClick={() => (added ? remove(kind, id) : add({ kind, id, name, price }))}
    >
      {added ? (
        <>
          <IconX size={13} /> Remove
        </>
      ) : (
        <>
          <IconPlus size={13} /> Add
        </>
      )}
    </button>
  );
}

const CONFIDENCE_LABEL: Record<PrescriptionMatch['confidence'], string> = {
  high: 'Clear match',
  medium: 'Likely match',
  low: 'Hard to read — please check',
};

function PrescriptionResult({ rx }: { rx: Prescription }) {
  const { add, has } = useCart();
  const navigate = useNavigate();
  const bookable = rx.matches.filter((m) => m.catalogId && m.kind && m.name != null && m.price != null);
  const allAdded = bookable.length > 0 && bookable.every((m) => has(m.kind!, m.catalogId!));

  const addAll = () => {
    for (const m of bookable) add({ kind: m.kind!, id: m.catalogId!, name: m.name!, price: Number(m.price) });
  };

  return (
    <div className="card rx-result">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconFileText size={15} />
        Tests on your prescription
      </div>
      {rx.doctorName && <p className="page-sub" style={{ margin: '0 0 10px' }}>Prescribed by {rx.doctorName}</p>}

      {rx.matches.length === 0 ? (
        <p className="page-sub">{rx.notes ?? "We couldn't find lab tests on this image."}</p>
      ) : (
        <div className="suggest-list">
          {rx.matches.map((m, i) => (
            <div className={`suggest-row${m.catalogId ? '' : ' muted'}`} key={`${m.writtenAs}-${i}`}>
              <div style={{ minWidth: 0 }}>
                <div className="suggest-name">{m.name ?? m.writtenAs}</div>
                <div className="suggest-meta">
                  Written as “{m.writtenAs}” ·{' '}
                  {m.catalogId ? (
                    <span className={`confidence ${m.confidence}`}>{CONFIDENCE_LABEL[m.confidence]}</span>
                  ) : (
                    'Not offered here'
                  )}
                </div>
              </div>
              {m.catalogId && m.kind && m.name && m.price != null && (
                <div className="suggest-actions">
                  <span className="suggest-price">{formatCurrency(m.price)}</span>
                  <AddButton kind={m.kind} id={m.catalogId} name={m.name} price={Number(m.price)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rx.notes && rx.matches.length > 0 && (
        <div className="info-note" style={{ marginTop: 12 }}>
          {rx.notes}
        </div>
      )}

      {bookable.length > 0 && (
        <div className="action-row">
          {!allAdded && (
            <button type="button" className="btn" onClick={addAll}>
              <IconPlus size={14} /> Add all to cart
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => navigate('/book')}>
            Book now
          </button>
        </div>
      )}
      <p className="page-sub" style={{ margin: '12px 0 0', fontSize: 11.5 }}>
        Our team also sees your upload and will call you if anything needs checking.
      </p>
    </div>
  );
}

function PrescriptionTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Prescription | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const history = useApi<Prescription[]>(() => api.get('/prescriptions/mine'), []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const rx = await api.upload<Prescription>('/prescriptions', form);
      setResult(rx);
      history.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const past = (history.data ?? []).filter((p) => p.id !== result?.id);

  return (
    <>
      <div className="card">
        <label className={`upload-drop${uploading ? ' busy' : ''}`}>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={uploading}
            hidden
          />
          {preview ? (
            <img src={preview} alt="" className="upload-preview" onError={() => setPreview(null)} />
          ) : (
            <span className="upload-drop-icon">
              <IconUpload size={24} />
            </span>
          )}
          <span className="upload-drop-title">{uploading ? 'Reading your prescription…' : 'Choose photo or PDF'}</span>
          <span className="upload-drop-sub">A clear photo or PDF of the prescription. Handwritten is fine.</span>
        </label>
        {uploading && <LoadingLine label="Reading your prescription…" />}
        {error && (
          <div className="error-banner" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>

      {result && <PrescriptionResult rx={result} />}

      {past.length > 0 && (
        <>
          <div className="section-title">Earlier uploads</div>
          <div className="card">
            <div className="suggest-list">
              {past.map((p) => (
                <button type="button" className="suggest-row as-button" key={p.id} onClick={() => setResult(p)}>
                  <div style={{ minWidth: 0 }}>
                    <div className="suggest-name">{p.fileName}</div>
                    <div className="suggest-meta">
                      {formatDateTime(p.createdAt)} · {p.matches.filter((m) => m.catalogId).length} test(s) found
                    </div>
                  </div>
                  <span className="suggest-price">View →</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SuggestionList({ items }: { items: TestSuggestion[] }) {
  return (
    <div className="suggest-list">
      {items.map((s) => (
        <div className="suggest-row" key={s.catalogId}>
          <div style={{ minWidth: 0 }}>
            <Link
              className="suggest-name"
              to={s.kind === 'test' ? `/catalog/tests/${s.catalogId}` : `/catalog/packages/${s.catalogId}`}
            >
              {s.name}
            </Link>
            <div className="suggest-meta">{s.reason}</div>
          </div>
          <div className="suggest-actions">
            <span className="suggest-price">{formatCurrency(s.price)}</span>
            <AddButton kind={s.kind} id={s.catalogId} name={s.name} price={s.price} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SymptomsTab() {
  const navigate = useNavigate();
  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestFinderResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await api.post<TestFinderResult>('/test-finder', {
          symptoms,
          age: age ? Number(age) : undefined,
          gender: gender || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <label className="field">
          <span>What are you feeling or want to check?</span>
          <textarea
            rows={3}
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="e.g. Always tired, hair fall, gaining weight"
            required
            minLength={3}
            maxLength={1000}
          />
        </label>
        <div className="form-grid detail-grid" style={{ marginTop: 10 }}>
          <label className="field">
            <span>Age</span>
            <input type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
          </label>
          <label className="field">
            <span>Gender</span>
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">—</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </div>
        <div className="action-row">
          <button type="submit" className="btn btn-primary" disabled={loading || symptoms.trim().length < 3}>
            <IconSparkle size={14} /> {loading ? 'Finding suitable tests…' : 'Suggest tests'}
          </button>
        </div>
        {loading && <LoadingLine label="Finding suitable tests…" />}
        {error && (
          <div className="error-banner" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </form>

      {result && (
        <div className="card">
          {result.urgent && result.urgentMessage && (
            <div className="urgent-banner">
              <IconAlertTriangle size={18} />
              <span>{result.urgentMessage}</span>
            </div>
          )}
          {result.suggestions.length > 0 && (
            <>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <IconSparkle size={15} /> Suggested tests
              </div>
              <SuggestionList items={result.suggestions} />
              <div className="action-row">
                <button type="button" className="btn btn-primary" onClick={() => navigate('/book')}>
                  Book now
                </button>
              </div>
            </>
          )}
          {result.advice && <div className="info-note" style={{ marginTop: 12 }}>{result.advice}</div>}
        </div>
      )}
      <p className="page-sub" style={{ fontSize: 11.5 }}>Suggestions are general guidance, not a diagnosis. Please consult your doctor.</p>
    </>
  );
}

// Two ways in for someone who doesn't know a test's name: a photo of what
// their doctor wrote, or a description of what's wrong. Both end in the
// same place — catalog items with an Add button — so booking works exactly
// as it does from the catalog.
export function SmartBookPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'symptoms' ? 'symptoms' : 'rx';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Find the right tests</h1>
          <p className="page-sub">
            Upload your doctor's prescription, or tell us what's bothering you — we'll suggest tests from our catalog.
          </p>
        </div>
      </div>

      <div className="segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rx'}
          className={tab === 'rx' ? 'active' : ''}
          onClick={() => setParams({ tab: 'rx' }, { replace: true })}
        >
          <IconUpload size={15} /> Upload prescription
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'symptoms'}
          className={tab === 'symptoms' ? 'active' : ''}
          onClick={() => setParams({ tab: 'symptoms' }, { replace: true })}
        >
          <IconStethoscope size={15} /> Describe symptoms
        </button>
      </div>

      {!user ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700 }}>Log in to continue</div>
            <p className="page-sub" style={{ margin: '2px 0 0' }}>
              Sign in so we can save your prescription and suggestions to your account.
            </p>
          </div>
          <Link className="btn btn-primary" to="/login" state={{ from: location }}>
            Log in
          </Link>
        </div>
      ) : tab === 'rx' ? (
        <PrescriptionTab />
      ) : (
        <SymptomsTab />
      )}
    </>
  );
}
