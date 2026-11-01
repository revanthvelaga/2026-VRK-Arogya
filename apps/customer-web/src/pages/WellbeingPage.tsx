import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowLeft, IconShieldCheck } from '../components/Icons';
import {
  CATEGORIES,
  GOAL_CHOICES,
  appColor,
  appLabel,
  APPS,
  fmtMinutes,
  loadGoal,
  saveGoal,
  scoreTone,
  sumReels,
  useWellbeing,
  wellbeingScore,
} from '../lib/wellbeing';
import type { WellbeingData } from '../lib/wellbeing';

const REELS_NOTICE_KEY = 'arogya_reels_notice_ok';
const noticeOk = () => {
  try {
    return localStorage.getItem(REELS_NOTICE_KEY) === '1';
  } catch {
    return false;
  }
};

function weekday(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
}

function ScoreRing({ score, tone }: { score: number; tone: 'good' | 'ok' | 'high' }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className={`wb-ring ${tone}`}>
      <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} className="wb-ring-bg" />
        <circle cx="64" cy="64" r={r} className="wb-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 64 64)" />
      </svg>
      <div className="wb-ring-num">
        <b>{score}</b>
        <small>wellbeing</small>
      </div>
    </div>
  );
}

function tip(minutes: number, goal: number, reels: number): string {
  if (reels >= 150) return `${reels} reels in a day is a lot — short, fast videos keep the brain on “one more”. Try a 30-minute cap, or keep the phone out of the bedroom tonight.`;
  if (minutes > goal) return 'You’re over your goal today. A walk or a glass of water is a good reset — and screens in the last hour before bed hurt sleep the most.';
  if (minutes > goal * 0.75) return 'You’re close to your daily goal. Try the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds to rest your eyes.';
  return 'Nice and balanced. Keep it up — good sleep and light screen time go hand in hand with better health results.';
}

function Dashboard({ data, preview, openSettings }: { data: WellbeingData; preview: boolean; openSettings: (w: 'usage' | 'reels') => void }) {
  const [goal, setGoal] = useState(loadGoal);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const days = data.days;
  const today = days[days.length - 1];
  const day = days.find((d) => d.date === selected) ?? today;
  const isToday = day === today;
  const reels = sumReels(day);
  const score = wellbeingScore(day.total, goal, reels, day.night ?? 0, day.sleep?.minutes, day.longest?.minutes);
  const { label, tone } = scoreTone(score);
  const weekAvg = Math.round(days.reduce((a, d) => a + d.total, 0) / Math.max(days.length, 1));
  const weekReels = days.reduce((a, d) => a + sumReels(d), 0);
  const max = Math.max(goal * 1.15, ...days.map((d) => d.total), 1);
  const apps = useMemo(
    () => Object.entries(day.apps).sort((a, b) => b[1] - a[1]),
    [day],
  );
  const reelRows = useMemo(() => Object.entries(day.reels).sort((a, b) => b[1] - a[1]), [day]);
  const topApp = apps[0];

  return (
    <>
      {preview && (
        <div className="wb-banner">
          Sample data. Open Arogya in the Android app to see your own screen time.
        </div>
      )}

      <div className="card wb-hero">
        <ScoreRing score={score} tone={tone} />
        <div className="wb-hero-text">
          <div className="wb-eyebrow">{isToday ? 'Today' : weekday(day.date) + ' · ' + day.date.slice(5)}</div>
          <div className="wb-big">{fmtMinutes(day.total)}</div>
          <div className={`wb-pill ${tone}`}>{label}</div>
          <div className="wb-sub">Goal {fmtMinutes(goal)} a day{topApp ? ` · most time on ${appLabel(topApp[0])}` : ''}</div>
        </div>
      </div>

      <div className="wb-two">
        <div className="card wb-stat">
          <div className="wb-eyebrow">Reels & shorts</div>
          <div className="wb-stat-num">{data.reelsAccess ? reels.toLocaleString() : '–'}</div>
          <small>{data.reelsAccess ? `${weekReels.toLocaleString()} this week` : 'Turn on counting below'}</small>
        </div>
        <div className="card wb-stat">
          <div className="wb-eyebrow">Daily average</div>
          <div className="wb-stat-num">{fmtMinutes(weekAvg)}</div>
          <small>last {days.length} days</small>
        </div>
        <div className="card wb-stat">
          <div className="wb-eyebrow">Phone pick-ups</div>
          <div className="wb-stat-num">{day.unlocks ?? '–'}</div>
          <small>times unlocked</small>
        </div>
        <div className="card wb-stat">
          <div className="wb-eyebrow">Late night use</div>
          <div className="wb-stat-num">{fmtMinutes(day.night ?? 0)}</div>
          <small>between 11 pm and 5 am</small>
        </div>
      </div>

      <div className="wb-two wb-two-cards">
        <div className="card wb-break">
          <div className="wb-card-title">
            <b>⏱️ Without a break</b>
          </div>
          {day.longest ? (
            <>
              <div className="wb-stat-num">{fmtMinutes(day.longest.minutes)}</div>
              <small className="wb-muted">
                longest stretch, {day.longest.start}–{day.longest.end}
              </small>
              <div className="wb-break-row">
                <span>
                  <b>{day.longStretches ?? 0}</b> over 30 min
                </span>
                <span>
                  <b>{day.sessions ?? 0}</b> sittings
                </span>
              </div>
              {day.longest.minutes > 45 && <p className="wb-hint">Look away and stretch every 30 minutes. Long sittings strain the eyes, neck and back.</p>}
            </>
          ) : (
            <p className="wb-empty">No long sittings {isToday ? 'yet today' : 'that day'}.</p>
          )}
        </div>
        <div className="card wb-charge">
          <div className="wb-card-title">
            <b>🔌 Charged</b>
          </div>
          {day.charges === undefined ? (
            <p className="wb-empty">Update the app to count charges.</p>
          ) : (
            <>
              <div className="wb-stat-num">
                {day.charges.length} <span className="wb-unit">time{day.charges.length === 1 ? '' : 's'}</span>
              </div>
              {day.charges.length === 0 ? (
                <small className="wb-muted">{isToday ? 'Not charged yet today' : 'Not charged that day'}</small>
              ) : (
                <ul className="wb-charges">
                  {day.charges.map((c, i) => (
                    <li key={i}>
                      <span>
                        {c.start}–{c.now ? 'now' : c.end}
                      </span>
                      {c.from >= 0 && c.to >= 0 && (
                        <b>
                          {c.from}% → {c.to}%
                        </b>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card wb-sleep">
        <div className="wb-card-title">
          <b>🌙 Night sleep</b>
          <small>estimated from your phone</small>
        </div>
        {day.sleep ? (
          <>
            <div className="wb-sleep-main">
              <div>
                <div className="wb-big wb-sleep-big">{fmtMinutes(day.sleep.minutes)}</div>
                <div className={`wb-pill ${day.sleep.minutes >= 420 ? 'good' : day.sleep.minutes >= 360 ? 'ok' : 'high'}`}>
                  {day.sleep.minutes >= 420 ? 'Well rested' : day.sleep.minutes >= 360 ? 'A little short' : 'Not enough'}
                </div>
              </div>
              <div className="wb-sleep-times">
                <span><small>Phone down</small><b>{day.sleep.bed}</b></span>
                <span><small>Phone up</small><b>{day.sleep.wake}</b></span>
              </div>
            </div>
            <div className="wb-sleep-week" aria-label="Sleep over the week">
              {days.map((d) => (
                <button key={d.date} type="button" className={`wb-sleep-col${d === day ? ' sel' : ''}`} onClick={() => setSelected(d.date)} aria-label={`${weekday(d.date)} sleep`}>
                  <span className="wb-sleep-bar">
                    <span style={{ height: `${Math.min(100, ((d.sleep?.minutes ?? 0) / 600) * 100)}%` }} className={(d.sleep?.minutes ?? 0) >= 420 ? 'ok' : 'low'} />
                  </span>
                  <small>{d.sleep ? (d.sleep.minutes / 60).toFixed(1) : '–'}</small>
                </button>
              ))}
            </div>
            <p className="wb-note">The longest stretch last night when the phone wasn’t touched. If you read in bed or woke for a while, the real number differs.</p>
          </>
        ) : (
          <p className="wb-empty">{data.usageAccess ? 'No clear night yet — it shows once the phone has stayed quiet for 3 hours or more overnight.' : 'Turn on screen-time access to estimate your sleep.'}</p>
        )}
      </div>

      <div className="card">
        <div className="wb-card-title">
          <b>Where the time goes</b>
          <small>{isToday ? 'today' : weekday(day.date)}</small>
        </div>
        {day.total > 0 && day.cats ? (
          <>
            <div className="wb-split" role="img" aria-label="Time by kind of app">
              {CATEGORIES.map((c) => {
                const v = day.cats?.[c.key] ?? 0;
                return v > 0 ? <span key={c.key} style={{ width: `${(v / Math.max(day.total, 1)) * 100}%`, background: c.color }} /> : null;
              })}
            </div>
            <ul className="wb-cats">
              {CATEGORIES.map((c) => {
                const v = day.cats?.[c.key] ?? 0;
                return (
                  <li key={c.key}>
                    <i style={{ background: c.color }} />
                    <span>{c.label}</span>
                    <b>{fmtMinutes(v)}</b>
                  </li>
                );
              })}
            </ul>
            <p className="wb-note">Calls is time spent in the phone and meeting apps. Messaging covers WhatsApp, Telegram and SMS.</p>
          </>
        ) : (
          <p className="wb-empty">Nothing recorded yet.</p>
        )}
      </div>

      <div className="card wb-chart-card">
        <div className="wb-card-title">
          <b>This week</b>
          <small>Tap a day</small>
        </div>
        <div className="wb-chart" role="img" aria-label="Screen time for the last 7 days">
          <div className="wb-goal-line" style={{ bottom: `${22 + (goal / max) * 112}px` }}>
            <span>goal</span>
          </div>
          {days.map((d) => {
            const over = d.total > goal;
            return (
              <button
                key={d.date}
                type="button"
                className={`wb-bar-col${d === day ? ' sel' : ''}`}
                onClick={() => setSelected(d.date)}
                aria-label={`${weekday(d.date)} ${fmtMinutes(d.total)}`}
              >
                <span className="wb-bar-track">
                  <span className="wb-bar-val">{d.total ? fmtMinutes(d.total) : ''}</span>
                  <span className={`wb-bar${over ? ' over' : ''}`} style={{ height: `${Math.max(3, (d.total / max) * 112)}px` }} />
                </span>
                <span className="wb-bar-day">{d === today ? 'Today' : weekday(d.date)}</span>
              </button>
            );
          })}
        </div>
        <div className="wb-goal-pick">
          <span>Daily goal</span>
          {GOAL_CHOICES.map((g) => (
            <button
              key={g}
              type="button"
              className={`wb-goal-chip${goal === g ? ' on' : ''}`}
              onClick={() => {
                setGoal(g);
                saveGoal(g);
              }}
            >
              {g / 60}h
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="wb-card-title">
          <b>{isToday ? 'Today by app' : 'By app'}</b>
          <small>{apps.length ? 'minutes' : ''}</small>
        </div>
        {apps.length === 0 ? (
          <p className="wb-empty">No social or video apps used {isToday ? 'yet today' : 'that day'}.</p>
        ) : (
          <ul className="wb-apps">
            {apps.map(([pkg, min]) => {
              const r = day.reels[pkg] ?? 0;
              const kind = APPS[pkg]?.reels;
              return (
                <li key={pkg}>
                  <span className="wb-app-dot" style={{ background: appColor(pkg) }}>
                    {appLabel(pkg).charAt(0)}
                  </span>
                  <span className="wb-app-body">
                    <span className="wb-app-top">
                      <b>{appLabel(pkg)}</b>
                      <span>{fmtMinutes(min)}</span>
                    </span>
                    <span className="wb-app-track">
                      <span style={{ width: `${(min / apps[0][1]) * 100}%`, background: appColor(pkg) }} />
                    </span>
                    {data.reelsAccess && r > 0 && kind && (
                      <small>
                        {r.toLocaleString()} {kind.toLowerCase()} swiped
                      </small>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {data.reelsAccess && reelRows.length > 0 && <div className="wb-note">Reel counts are an estimate — they depend on how each app lays out its screens.</div>}
      </div>

      <div className={`card wb-tip ${tone}`}>
        <b>For your health</b>
        <p>{tip(day.total, goal, reels)}</p>
      </div>

      {!preview && (!data.usageAccess || !data.reelsAccess) && (
        <div className="card wb-setup">
          <div className="wb-card-title">
            <b>Set up</b>
          </div>
          {!data.usageAccess && (
            <div className="wb-step">
              <div>
                <b>1. Show my screen time</b>
                <small>Opens Android’s “Usage access”. Find Arogya in the list and switch it on.</small>
              </div>
              <button type="button" className="btn btn-primary btn-small" onClick={() => openSettings('usage')}>
                Allow
              </button>
            </div>
          )}
          {!data.reelsAccess && (
            <div className="wb-step col">
              <div>
                <b>{data.usageAccess ? '1' : '2'}. Count my reels (optional)</b>
                <small>Needs Android’s accessibility setting. Please read what it does first.</small>
              </div>
              {!notice && !noticeOk() ? (
                <button type="button" className="btn btn-small" onClick={() => setNotice(true)}>
                  Read how it works
                </button>
              ) : (
                <div className="wb-disclosure">
                  <IconShieldCheck size={18} />
                  <p>
                    <b>What Arogya counts.</b> Arogya uses Android’s accessibility service only to notice when you swipe to the next reel or short in
                    Instagram, YouTube, Facebook and Snapchat. It adds one to a number. It does <b>not</b> read, record or send what is on your screen,
                    your messages, passwords or anything you type. The numbers stay on this phone, and you can switch this off any time in Android
                    settings.
                  </p>
                  <div className="wb-disclosure-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={() => {
                        try {
                          localStorage.setItem(REELS_NOTICE_KEY, '1');
                        } catch {
                          // ignore
                        }
                        openSettings('reels');
                      }}
                    >
                      I agree — open settings
                    </button>
                    <button type="button" className="btn btn-small wb-link" onClick={() => setNotice(false)}>
                      Not now
                    </button>
                  </div>
                  <small>In Android settings: Accessibility → Installed apps → Arogya reel counter → turn on.</small>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="wb-privacy">
        <IconShieldCheck size={14} /> Your screen-time numbers stay on your phone. Arogya doesn’t upload them.
      </p>
    </>
  );
}

export function WellbeingPage() {
  const { state, openSettings } = useWellbeing();
  return (
    <div className="wb-page">
      <Link className="back-link" to="/profile">
        <IconArrowLeft size={16} /> Account
      </Link>
      <div className="page-header">
        <div>
          <h1>Digital wellbeing</h1>
          <p className="page-sub">How much time reels and apps take — and what it means for your health.</p>
        </div>
      </div>

      {state.kind === 'loading' && <p className="wb-empty">Reading your screen time…</p>}
      {state.kind === 'unsupported' && <p className="wb-empty">This phone can’t share screen-time data with Arogya.</p>}
      {state.kind === 'old-app' && (
        <div className="card wb-tip ok">
          <b>Update the Arogya app</b>
          <p>Screen time and reel counting need the latest Arogya Android app (v1.12 or newer). Install the newest version and open this page again.</p>
        </div>
      )}
      {state.kind === 'browser' && <Dashboard data={state.data} preview openSettings={openSettings} />}
      {state.kind === 'ready' && <Dashboard data={state.data} preview={false} openSettings={openSettings} />}
    </div>
  );
}
