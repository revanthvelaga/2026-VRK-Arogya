import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  IconActivity,
  IconArrowRight,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconFlask,
  IconMapPin,
  IconShieldCheck,
  IconTruck,
} from '../components/Icons';

const STEPS = [
  {
    n: 1,
    title: 'Pick your tests',
    body: 'Browse individual tests or bundled packages, priced up front — no surprises at collection.',
  },
  {
    n: 2,
    title: 'Choose how to collect',
    body: 'Walk in to the center, get picked up at a nearby village pickup point, or a home visit.',
  },
  {
    n: 3,
    title: 'Track your sample',
    body: 'See exactly where your sample is — collected, in transit, at the lab, result ready.',
  },
];

export function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <div>
          <div className="hero-eyebrow">Arogya · Diagnostic Lab Booking</div>
          <h1>Book a lab test without the trip to the city.</h1>
          <p className="lead">
            Real diagnostic tests, real prices, collected near you — walk in, a village pickup
            point, or a home visit. Track your sample the whole way, from collection to result.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to={user ? '/book' : '/register'}>
              Book a test
            </Link>
            <Link className="btn" to="/catalog">
              Browse the catalog
              <IconArrowRight size={15} />
            </Link>
          </div>
          <div className="trust-row">
            <div className="trust-item">
              <IconShieldCheck size={17} />
              Accredited testing
            </div>
            <div className="trust-item">
              <IconClock size={17} />
              24–48h turnaround
            </div>
            <div className="trust-item">
              <IconMapPin size={17} />
              Village pickup points
            </div>
          </div>
        </div>

        <div className="hero-art">
          <div className="hero-art-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="icon-chip">
                <IconFlask size={15} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Complete Blood Count</div>
                <div className="page-sub" style={{ margin: 0 }}>
                  Blood · 24h turnaround
                </div>
              </div>
            </div>
            <div style={{ fontFamily: 'Sora', fontWeight: 800 }}>₹250</div>
          </div>
          <div className="hero-art-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="icon-chip">
                <IconTruck size={15} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>In transit to center</div>
                <div className="page-sub" style={{ margin: 0 }}>
                  Updated 12 minutes ago
                </div>
              </div>
            </div>
            <IconCheckCircle size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="hero-art-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="icon-chip">
                <IconCalendar size={15} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Pickup point visit</div>
                <div className="page-sub" style={{ margin: 0 }}>
                  Tomorrow, 9:00–11:00 AM
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-title">How it works</div>
      <div className="steps-grid">
        {STEPS.map((s) => (
          <div className="step-card" key={s.n}>
            <div className="step-number">{s.n}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div className="stat-icon" style={{ margin: 0 }}>
          <IconActivity size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>Not sure what to book?</div>
          <p className="page-sub" style={{ margin: '2px 0 0' }}>
            Browse the full catalog of tests and packages, with prices and turnaround times up
            front.
          </p>
        </div>
        <Link className="btn btn-primary btn-small" to="/catalog">
          View catalog
        </Link>
      </div>
    </>
  );
}
