import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { Coupon } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { IconPlus, IconTag } from '../components/Icons';
import { formatCurrency, formatDateTime } from '../lib/format';

function describe(c: Coupon): string {
  const off =
    c.discountType === 'PERCENT'
      ? `${Number(c.value)}% off${c.maxDiscount ? ` (max ${formatCurrency(c.maxDiscount)})` : ''}`
      : `${formatCurrency(c.value)} off`;
  return Number(c.minOrder) > 0 ? `${off} on orders above ${formatCurrency(c.minOrder)}` : off;
}

function CouponForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FLAT'>('PERCENT');
  const [value, setValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perCustomerLimit, setPerCustomerLimit] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/coupons', {
        code: code.trim(),
        description: description.trim(),
        discountType,
        value: Number(value),
        maxDiscount: discountType === 'PERCENT' && maxDiscount ? Number(maxDiscount) : undefined,
        minOrder: minOrder ? Number(minOrder) : 0,
        validUntil: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : undefined,
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        perCustomerLimit: Number(perCustomerLimit) || 1,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the offer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="New offer code" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="FIRST20"
              maxLength={20}
              required
            />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'PERCENT' | 'FLAT')}>
              <option value="PERCENT">Percentage off</option>
              <option value="FLAT">Flat ₹ off</option>
            </select>
          </div>
          <div className="field field-full">
            <label>Shown to customers as</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="20% off your first checkup, up to ₹300"
              maxLength={200}
              required
            />
          </div>
          <div className="field">
            <label>{discountType === 'PERCENT' ? 'Percent (1-100)' : 'Amount (₹)'}</label>
            <input
              type="number"
              min={1}
              max={discountType === 'PERCENT' ? 100 : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          {discountType === 'PERCENT' && (
            <div className="field">
              <label>Max discount ₹ (optional)</label>
              <input type="number" min={1} value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Minimum order ₹</label>
            <input type="number" min={0} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          </div>
          <div className="field">
            <label>Valid until (optional)</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="field">
            <label>Total uses (optional)</label>
            <input type="number" min={1} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} />
          </div>
          <div className="field">
            <label>Uses per customer</label>
            <input
              type="number"
              min={1}
              value={perCustomerLimit}
              onChange={(e) => setPerCustomerLimit(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create offer'}
        </button>
      </form>
    </Modal>
  );
}

// Offer codes customers can apply at checkout. Customers also see active,
// unexpired ones as one-tap suggestions in their order summary.
export function OffersPage() {
  const { data, loading, error, reload } = useApi<Coupon[]>(() => api.get('/coupons'), []);
  const [creating, setCreating] = useState(false);

  const toggle = async (c: Coupon) => {
    await api.patch(`/coupons/${c.id}`, { isActive: !c.isActive });
    reload();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Offers</h1>
          <p className="page-sub">Discount codes for checkout. Referral rewards (₹100 each way) run automatically.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <IconPlus size={15} /> New offer
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading offers…" />
      ) : (data ?? []).length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconTag size={20} />} title="No offers yet" subtitle="Create a code like FIRST20 to get started." />
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Offer</th>
                <th>Limits</th>
                <th>Valid until</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c) => (
                <tr key={c.id}>
                  <td>
                    <b style={{ letterSpacing: '0.04em' }}>{c.code}</b>
                    <div className="page-sub" style={{ margin: 0 }}>
                      {c.description}
                    </div>
                  </td>
                  <td>{describe(c)}</td>
                  <td>
                    {c.usageLimit ? `${c.usageLimit} total` : 'Unlimited'} · {c.perCustomerLimit}/customer
                  </td>
                  <td>{c.validUntil ? formatDateTime(c.validUntil).split(',')[0] : 'No expiry'}</td>
                  <td>
                    <button className={`btn btn-small${c.isActive ? '' : ' btn-primary'}`} onClick={() => toggle(c)}>
                      {c.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <span className={`badge ${c.isActive ? 'badge-accent' : 'badge-neutral'}`} style={{ marginLeft: 8 }}>
                      {c.isActive ? 'Live' : 'Paused'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CouponForm onClose={() => setCreating(false)} onSaved={reload} />}
    </>
  );
}
