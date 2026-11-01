import { useState } from 'react';
import { Link } from 'react-router-dom';

// Photos: Unsplash, free under the Unsplash License (unsplash.com/license).
const img = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&crop=faces&q=70&auto=format`;

interface Topic {
  label: string;
  hint: string;
  to: string;
  photo: string;
}

// Each topic opens the catalog already narrowed to the tests that matter
// for it, so it's one tap from "I'm worried about X" to something to book.
const TOPICS: Topic[] = [
  { label: 'Thyroid & PCOS', hint: 'Hormone checks', to: '/catalog?q=thyroid', photo: 'photo-1631558554226-fb65b25aa939' },
  { label: 'Fertility', hint: 'Planning a baby', to: '/catalog?audience=WOMEN', photo: 'photo-1517236703105-9ec38fec32a3' },
  { label: 'Pregnancy', hint: 'Care for you both', to: '/catalog?audience=WOMEN', photo: 'photo-1457342813143-a1ae27448a82' },
  { label: 'Vitamins & diet', hint: 'D, B12, iron', to: '/catalog?q=vitamin', photo: 'photo-1567290354046-7c20adfd20ef' },
  { label: 'Weight & fitness', hint: 'Sugar, cholesterol', to: '/catalog?q=lipid', photo: 'photo-1564356533237-46945af0eb1e' },
  { label: 'Bones & joints', hint: 'After 40', to: '/catalog?q=bone', photo: 'photo-1769029174021-b305fa92f0ae' },
];

function Photo({ id, w, h, className }: { id: string; w: number; h: number; className: string }) {
  const [failed, setFailed] = useState(false);
  // Slow or blocked image CDN: a soft tint instead of a broken-image icon.
  if (failed) return <span className={`${className} wellness-photo-fallback`} aria-hidden="true" />;
  return <img className={className} src={img(id, w, h)} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

export function WomenWellness() {
  return (
    <section className="wellness" aria-labelledby="wellness-title">
      <Link to="/catalog?audience=WOMEN" className="wellness-hero">
        <div className="wellness-hero-text">
          <h2 id="wellness-title">Women's wellness</h2>
          <p>Tests for every stage of life — for you, your mother and your daughter.</p>
          <span className="wellness-hero-cta">See women's packages</span>
        </div>
        <Photo id="photo-1752652011858-302f08a6dc9f" w={420} h={360} className="wellness-hero-photo" />
      </Link>
      <div className="wellness-grid">
        {TOPICS.map((t) => (
          <Link to={t.to} className="wellness-tile" key={t.label}>
            <Photo id={t.photo} w={300} h={260} className="wellness-tile-photo" />
            <b>{t.label}</b>
            <small>{t.hint}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
