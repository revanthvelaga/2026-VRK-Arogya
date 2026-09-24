import { Package } from '../catalog/entities/package.entity';
import { Test } from '../catalog/entities/test.entity';

export interface CatalogEntry {
  ref: string;
  kind: 'test' | 'package';
  id: string;
  name: string;
  price: number;
}

// The live catalog, rendered as a short reference list Claude picks from.
// Items get short refs (t1, p1…) instead of UUIDs: the schema then limits
// answers to exactly these refs, so a reply can never name a test we don't
// sell or a mistyped id.
export function buildCatalogContext(tests: Test[], packages: Package[]) {
  const entries: CatalogEntry[] = [];
  const lines: string[] = [];
  tests.forEach((t, i) => {
    const ref = `t${i + 1}`;
    entries.push({ ref, kind: 'test', id: t.id, name: t.name, price: Number(t.price) });
    lines.push(
      `${ref} | TEST | ${t.name}${t.code ? ` (${t.code})` : ''}${t.category ? ` | ${t.category}` : ''}${
        t.description ? ` | ${t.description.slice(0, 120)}` : ''
      }`,
    );
  });
  packages.forEach((p, i) => {
    const ref = `p${i + 1}`;
    entries.push({ ref, kind: 'package', id: p.id, name: p.name, price: Number(p.price) });
    const included = (p.tests ?? []).map((t) => t.name).join(', ');
    lines.push(`${ref} | PACKAGE | ${p.name}${included ? ` | includes: ${included}` : ''}`);
  });
  const byRef = new Map(entries.map((e) => [e.ref, e]));
  return { text: lines.join('\n'), refs: entries.map((e) => e.ref), byRef };
}
